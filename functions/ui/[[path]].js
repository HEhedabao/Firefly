// Cloudflare Pages Function：把 /ui* 反向代理到 Waline Worker
//
// 用途：让 Waline 管理面板（评论审核、反垃圾设置）也能通过 pages.dev 访问，
// 国内不挂代理即可打开后台。
// 实现与 functions/api/[[path]].js 相同（含 Accept-Encoding 处理说明）。

const WORKER_ORIGIN = "https://hehedabao-waline.1499264516.workers.dev";

export async function onRequest(context) {
	const { request } = context;
	const url = new URL(request.url);

	const target = new URL(url.pathname + url.search, WORKER_ORIGIN);

	const headers = new Headers(request.headers);
	headers.delete("accept-encoding");
	headers.delete("host");

	const init = {
		method: request.method,
		headers,
		redirect: "manual",
	};
	if (request.method !== "GET" && request.method !== "HEAD") {
		init.body = request.body;
	}

	let response;
	try {
		response = await fetch(target.toString(), init);
	} catch (err) {
		return new Response(`Proxy to Waline worker failed: ${err?.message ?? err}`, {
			status: 502,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		});
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});
}
