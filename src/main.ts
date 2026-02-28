import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from '@environments/environment';

if (environment.production) {
  const noop = () => {};
  console.log   = noop;
  console.info  = noop;
  console.debug = noop;
  console.warn  = noop;
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
