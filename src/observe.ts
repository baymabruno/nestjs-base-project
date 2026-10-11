import { createObserveModule } from '@nestjs/observe';

/**
 * Observability with @nestjs/observe (traces, errors, logs and metrics sent to
 * observe.nestjs.com). It is only enabled when OBSERVE_APP_KEY and
 * OBSERVE_APP_SECRET are set; otherwise no data leaves the application.
 *
 * sourceContext is off, so fragments of the source code are not sent with the
 * errors.
 */
export const { ObserveModule, ObserveInstrument } = createObserveModule({
  sourceContext: false,
});

export const isObserveEnabled = (env: NodeJS.ProcessEnv) =>
  !!env.OBSERVE_APP_KEY && !!env.OBSERVE_APP_SECRET;
