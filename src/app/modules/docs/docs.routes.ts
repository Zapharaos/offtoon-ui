import {Routes} from "@angular/router";
import {TermsComponent} from "@modules/docs/pages/terms/terms.component";
import {PrivacyComponent} from "@modules/docs/pages/privacy/privacy.component";

export const routes: Routes = [

  {
    path: 'terms',
    component: TermsComponent,
    data: { seo: { titleKey: 'seo.terms.title', descKey: 'seo.terms.desc', index: true } }
  },
  {
    path: 'privacy',
    component: PrivacyComponent,
    data: { seo: { titleKey: 'seo.privacy.title', descKey: 'seo.privacy.desc', index: true } }
  },
];
