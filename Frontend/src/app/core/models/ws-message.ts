import { Candle } from "./candle";
import { Quote } from "./quote";

export type WsMessage =
    | { type: 'info'; data: { message: string } }
    | { type: 'quote'; data: Quote }
    | { type: 'candle'; data: Candle };
