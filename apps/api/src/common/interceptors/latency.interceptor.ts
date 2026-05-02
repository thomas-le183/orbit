import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
} from "@nestjs/common";
import { delay, Observable } from "rxjs";

/**
 * Development-only interceptor that adds a random 300–1000ms delay to every
 * response, simulating real-world network and server latency so that loading
 * states, spinners, and async UI flows can be tested locally before deployment.
 *
 * Registered in main.ts only when NODE_ENV === "development".
 */
@Injectable()
export class LatencyInterceptor implements NestInterceptor {
	intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
		const ms = 300 + Math.random() * 700; // 300–1000ms
		return next.handle().pipe(delay(ms));
	}
}
