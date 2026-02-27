import { expect, test, type Page } from '@playwright/test';

const CANDLES = [
  { symbol: 'BTCUSD', timestamp: 1_710_000_000, open: 100, high: 110, low: 95, close: 105, volume: 12 },
  { symbol: 'BTCUSD', timestamp: 1_710_000_060, open: 105, high: 112, low: 103, close: 109, volume: 15 },
];

const installWebSocketMock = async (page: Page) => {
  await page.addInitScript(() => {
    class MockSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      static instances: MockSocket[] = [];

      readonly url: string | URL;
      readyState = MockSocket.CONNECTING;
      onopen: ((ev: Event) => void) | null = null;
      onmessage: ((ev: MessageEvent) => void) | null = null;
      onclose: ((ev: CloseEvent) => void) | null = null;
      onerror: ((ev: Event) => void) | null = null;

      constructor(url: string | URL) {
        this.url = url;
        MockSocket.instances.push(this);
        setTimeout(() => {
          this.readyState = MockSocket.OPEN;
          this.onopen?.(new Event('open'));
        }, 0);
      }

      send(_data: string | ArrayBufferLike | Blob | ArrayBufferView): void {}

      close(_code?: number, _reason?: string): void {
        this.readyState = MockSocket.CLOSED;
        this.onclose?.(new CloseEvent('close', { wasClean: true, code: 1000, reason: 'normal close' }));
      }

      emitMessage(payload: unknown): void {
        this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(payload) }));
      }

      emitUncleanClose(): void {
        this.readyState = MockSocket.CLOSED;
        this.onclose?.(new CloseEvent('close', { wasClean: false, code: 1006, reason: 'network error' }));
      }

      addEventListener(): void {}
      removeEventListener(): void {}
      dispatchEvent(): boolean {
        return true;
      }
    }

    (window as Window & { __mockWs: unknown }).__mockWs = {
      send(payload: unknown) {
        MockSocket.instances.forEach((s) => s.emitMessage(payload));
      },
      closeUnclean() {
        MockSocket.instances.forEach((s) => s.emitUncleanClose());
      },
      reset() {
        MockSocket.instances = [];
      },
    };

    Object.defineProperty(window, 'WebSocket', {
      writable: true,
      configurable: true,
      value: MockSocket,
    });
  });
};

test.beforeEach(async ({ page }) => {
  await installWebSocketMock(page);
});

test('renders dashboard, connects websocket and shows live quote', async ({ page }) => {
  await page.route('**/api/candles**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CANDLES) });
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Market Dashboard' })).toBeVisible();
  await expect(page.locator('.status')).toContainText('connected');

  await page.evaluate(() => {
    const bridge = (window as Window & { __mockWs: { send: (payload: unknown) => void } }).__mockWs;
    bridge.send({ type: 'quote', data: { symbol: 'BTCUSD', bid: 101.25, ask: 101.75, timestamp: 1_710_000_120 } });
  });

  await expect(page.locator('.quote-row')).toContainText('101.25');
  await expect(page.locator('.quote-row')).toContainText('101.75');
});

test('changes range and triggers candles refetch', async ({ page }) => {
  const requestedUrls: string[] = [];

  await page.route('**/api/candles**', async (route, request) => {
    requestedUrls.push(request.url());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CANDLES) });
  });

  await page.goto('/');
  await expect.poll(() => requestedUrls.length).toBeGreaterThan(0);

  const oneHourButton = page.getByRole('button', { name: '1h' });
  await oneHourButton.click();

  await expect(oneHourButton).toHaveClass(/active/);
  await expect.poll(() => requestedUrls.length).toBeGreaterThan(1);
});

test('shows dashboard error when candles API fails', async ({ page }) => {
  await page.route('**/api/candles**', async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: '[]' });
  });

  await page.goto('/');

  await expect(page.locator('.error')).toContainText('Failed to fetch candles from backend.');
});

test('shows warning alert after unclean websocket close', async ({ page }) => {
  await page.route('**/api/candles**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CANDLES) });
  });

  await page.goto('/');
  await expect(page.locator('.status')).toContainText('connected');

  await page.evaluate(() => {
    const bridge = (window as Window & { __mockWs: { closeUnclean: () => void } }).__mockWs;
    bridge.closeUnclean();
  });

  await expect(page.locator('.alert')).toContainText('WebSocket connection lost. Trying to reconnect...');
});
