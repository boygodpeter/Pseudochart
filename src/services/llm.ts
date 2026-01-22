// Adapter/薄封裝：統一 LLM 請求的 Result 介面（ok/data 或錯誤字串），入口可少用 try/catch；
// 也方便未來切換/增添 LLM provider、重試策略或 fallback 時，只改這層，不動外部 API 實作。
import { codeToPseudocode, PseudocodeResult } from './claudeApi';

// LLM 呼叫結果型別：成功或錯誤訊息
export type LLMResult =
	| { ok: true; data: PseudocodeResult }
	| { ok: false; error: string };

// 封裝 LLM 請求，統一錯誤訊息格式，避免在入口灑落 try/catch
export async function requestPseudocode(code: string, apiKey: string): Promise<LLMResult> {
	try {
		const data = await codeToPseudocode(code, apiKey);
		return { ok: true, data };
	} catch (err: any) {
		const message = err?.message ? String(err.message) : '未知錯誤';
		return { ok: false, error: message };
	}
}
