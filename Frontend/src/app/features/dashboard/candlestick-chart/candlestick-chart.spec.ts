import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CandlestickChart } from './candlestick-chart';

describe('CandlestickChart', () => {
  let component: CandlestickChart;
  let fixture: ComponentFixture<CandlestickChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CandlestickChart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CandlestickChart);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
