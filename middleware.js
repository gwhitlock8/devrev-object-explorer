// Edge middleware: password-protect all /customer/* routes
// Set the password via Vercel env var: CUSTOMER_PASSWORD

export const config = {
  matcher: '/customer/:path*',
};

export default function middleware(req) {
  const auth = req.headers.get('authorization');

  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic') {
      const decoded = atob(encoded);
      const [user, pass] = decoded.split(':');
      // Password is set via CUSTOMER_PASSWORD env var in Vercel
      if (pass === process.env.CUSTOMER_PASSWORD) {
        return;
      }
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Customer Object Explorer"',
    },
  });
}
