export async function authorize(ctx) {
  ctx.status = 302;
  ctx.redirect('http://127.0.0.1:5173/#code=local-demo-code&state=local-demo-state');
}

