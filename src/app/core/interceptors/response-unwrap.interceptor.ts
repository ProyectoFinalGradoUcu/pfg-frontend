import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

interface BackendEnvelope {
  service_response?: {
    service_status?: unknown;
    service_data?: unknown;
  };
}

export const responseUnwrapInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map((event) => {
      if (event instanceof HttpResponse && event.body !== null && typeof event.body === 'object') {
        const envelope = event.body as BackendEnvelope;
        if (envelope.service_response?.service_data !== undefined) {
          return event.clone({ body: envelope.service_response.service_data });
        }
      }
      return event;
    }),
  );
};
