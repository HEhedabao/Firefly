// Cloudflare Pages Function：把 /api/* 反向代理到 Waline Worker
//
// 为什么需要它：
//   Waline 后端部署在 Cloudflare Workers，域名为 *.workers.dev。
//   但 workers.dev 在中国大陆被 DNS 污染（解析到黑洞 IP），访客无法访问，
//   表现为评论框报 "Failed to fetch"。
//   而 pages.dev 域名解析正常、国内可直连，所以这里把 API 请求从
//   he-nbw.pages.dev/api/* 转发到 Worker。
//
// 说明：
//   1. 转发发生在 Cloudflare 网络内部，不受国内 DNS 污染影响。
//   2. 转发时不带 Accept-Encoding，让源站返回未压缩内容，
//      避免「压缩体 + 编码头」在多层代理间不一致的问题；
//      面向浏览器的压缩由 Cloudflare 边缘自动完成。

const WORKER_ORIGIN = "https://hehedabao-waline.1499264516.workers.dev";

export async function onRequest(context) {
	const { request } = context;
	const url = new URL(request.url);

	// 保留原始 path 和查询串，只替换 origin
	const target = new URL(url.pathname + url.search, WORKER_ORIGIN);

	// 复制请求头，但去掉 Accept-Encoding（见文件头说明第 2 点）
	const headers = new Headers(request.headers);
	headers.delete("accept-encoding");
	// Host 由运行时依据目标 URL 生成
	headers.delete("host");

	const init = {
		method: request.method,
		headers,
		redirect: "manual",
	};
	// GET / HEAD 不能带 body
	if (request.method !== "GET" && request.method !== "HEAD") {
		init.body = request.body;
	}

	let response;
	try {
		response = await fetch(target.toString(), init);
	} catch (err) {
		return new Response(
			JSON.stringify({
				errno: 1,
				errmsg: `Proxy to Waline worker failed: ${err?.message ?? err}`,
			}),
			{ status: 502, headers: { "Content-Type": "application/json" } },
		);
	}

	// 原样回传响应（状态码、CORS 头、Content-Type 等）
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});
}
