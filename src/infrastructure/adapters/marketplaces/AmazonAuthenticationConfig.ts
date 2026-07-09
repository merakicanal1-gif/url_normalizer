export const AmazonAuthenticationConfig = {
  cookies: {
    required: ['x-main', 'at-main', 'session-token']
  },
  urls: {
    loginKeywords: ['/ap/signin', '/ap/register']
  },
  selectors: {
    loginFormFields: ['input[name="email"]', '#ap_email', '#ap_password'],
    accountMenu: '#nav-link-accountList-nav-line-1'
  },
  texts: {
    authenticatedMenuKeywords: ['Olá,', 'Olá'],
    nonAuthenticatedKeywords: ['faça seu login', 'Sign in', 'fazer login']
  }
};
