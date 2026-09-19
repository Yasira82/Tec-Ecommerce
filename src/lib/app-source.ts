// The app's slug, as one exported value.
//
// This app predates `tec-template-base`, so it names itself with a bare literal
// inside the payment create route instead. That literal is deliberately NOT
// touched here — rewriting a live payment path is its own change with its own
// blast radius, and this one is about counting visits honestly.
//
// This is the canonical place now, and pointing that literal at it is a small
// follow-up with an obvious target rather than a search.
export const APP_SOURCE = 'ecommerce';
