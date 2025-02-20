import { jsx, jsxs } from "react/jsx-runtime";
import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter, useMatches, useActionData, useLoaderData, useParams, useRouteError, Meta, Links, ScrollRestoration, Scripts, Outlet, isRouteErrorResponse } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { createElement, useState } from "react";
import axios from "axios";
const streamTimeout = 5e3;
function handleRequest(request, responseStatusCode, responseHeaders, routerContext, loadContext) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    let userAgent = request.headers.get("user-agent");
    let readyOption = userAgent && isbot(userAgent) || routerContext.isSpaMode ? "onAllReady" : "onShellReady";
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(ServerRouter, { context: routerContext, url: request.url }),
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        }
      }
    );
    setTimeout(abort, streamTimeout + 1e3);
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest,
  streamTimeout
}, Symbol.toStringTag, { value: "Module" }));
function withComponentProps(Component) {
  return function Wrapped() {
    const props = {
      params: useParams(),
      loaderData: useLoaderData(),
      actionData: useActionData(),
      matches: useMatches()
    };
    return createElement(Component, props);
  };
}
function withErrorBoundaryProps(ErrorBoundary3) {
  return function Wrapped() {
    const props = {
      params: useParams(),
      loaderData: useLoaderData(),
      actionData: useActionData(),
      error: useRouteError()
    };
    return createElement(ErrorBoundary3, props);
  };
}
const links = () => [{
  rel: "preconnect",
  href: "https://fonts.googleapis.com"
}, {
  rel: "preconnect",
  href: "https://fonts.gstatic.com",
  crossOrigin: "anonymous"
}, {
  rel: "stylesheet",
  href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
}];
function Layout({
  children
}) {
  return /* @__PURE__ */ jsxs("html", {
    lang: "en",
    children: [/* @__PURE__ */ jsxs("head", {
      children: [/* @__PURE__ */ jsx("meta", {
        charSet: "utf-8"
      }), /* @__PURE__ */ jsx("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1"
      }), /* @__PURE__ */ jsx(Meta, {}), /* @__PURE__ */ jsx(Links, {})]
    }), /* @__PURE__ */ jsxs("body", {
      children: [children, /* @__PURE__ */ jsx(ScrollRestoration, {}), /* @__PURE__ */ jsx(Scripts, {})]
    })]
  });
}
const root = withComponentProps(function App() {
  return /* @__PURE__ */ jsx(Outlet, {});
});
const ErrorBoundary = withErrorBoundaryProps(function ErrorBoundary2({
  error
}) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack;
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  }
  return /* @__PURE__ */ jsxs("main", {
    className: "pt-16 p-4 container mx-auto",
    children: [/* @__PURE__ */ jsx("h1", {
      children: message
    }), /* @__PURE__ */ jsx("p", {
      children: details
    }), stack]
  });
});
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  Layout,
  default: root,
  links
}, Symbol.toStringTag, { value: "Module" }));
function Scraper() {
  const [channelName, setChannelName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fetchVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=id&type=channel&q=${encodeURIComponent(channelName)}&key=${apiKey}`;
      const searchResponse = await axios.get(searchUrl);
      const channelId = searchResponse.data.items[0].id.channelId;
      const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
      const channelResponse = await axios.get(channelUrl);
      const playlistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;
      let videoIds = [];
      let nextPageToken = "";
      do {
        const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=50&pageToken=${nextPageToken}&key=${apiKey}`;
        const playlistResponse = await axios.get(playlistUrl);
        playlistResponse.data.items.forEach((item) => {
          videoIds.push(item.contentDetails.videoId);
        });
        nextPageToken = playlistResponse.data.nextPageToken;
      } while (nextPageToken);
      let topShortestVideo = [];
      for (let i = 0; i < videoIds.length; i += 50) {
        const videoIdChunk = videoIds.slice(i, i + 50).join(",");
        const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIdChunk}&key=${apiKey}`;
        const videoResponse = await axios.get(videoUrl);
        videoResponse.data.items.forEach((item) => {
          const duration = parseISO8601Duration(item.contentDetails.duration);
          topShortestVideo.push({
            title: item.snippet.title,
            videoId: item.id,
            duration
          });
        });
      }
      topShortestVideo.sort((a, b) => a.duration - b.duration);
      setVideos(topShortestVideo.slice(0, 10));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const parseISO8601Duration = (duration) => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseInt(match[3] || "0", 10);
    return hours * 3600 + minutes * 60 + seconds;
  };
  return /* @__PURE__ */ jsxs("div", { className: "p-4 max-w-xl mx-auto", children: [
    /* @__PURE__ */ jsx("h1", { className: "text-xl font-bold", children: "YouTube Shortest Videos Scraper" }),
    /* @__PURE__ */ jsx(
      "input",
      {
        className: "border p-2 rounded w-full mt-4",
        type: "text",
        placeholder: "Enter YouTube Channel Name",
        value: channelName,
        onChange: (e) => setChannelName(e.target.value)
      }
    ),
    /* @__PURE__ */ jsx(
      "input",
      {
        className: "border p-2 rounded w-full mt-2",
        type: "text",
        placeholder: "Enter YouTube API Key",
        value: apiKey,
        onChange: (e) => setApiKey(e.target.value)
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: "bg-blue-500 text-white p-2 rounded mt-4 w-full",
        onClick: fetchVideos,
        disabled: loading,
        children: loading ? "Loading..." : "Fetch Videos"
      }
    ),
    error && /* @__PURE__ */ jsxs("p", { className: "text-red-500 mt-4", children: [
      "Error: ",
      error
    ] }),
    /* @__PURE__ */ jsx("ul", { className: "mt-4", children: videos.map((video, index) => /* @__PURE__ */ jsxs("li", { className: "border p-2 rounded mb-2", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold", children: video.title }),
      /* @__PURE__ */ jsxs("p", { children: [
        "Duration: ",
        video.duration,
        " seconds"
      ] }),
      /* @__PURE__ */ jsx(
        "a",
        {
          className: "text-blue-500 underline",
          href: `https://www.youtube.com/watch?v=${video.videoId}`,
          target: "_blank",
          rel: "noopener noreferrer",
          children: "Watch Video"
        }
      )
    ] }, index)) })
  ] });
}
function meta({}) {
  return [{
    title: "New React Router App"
  }, {
    name: "description",
    content: "Welcome to React Router!"
  }];
}
const home = withComponentProps(function Home() {
  return /* @__PURE__ */ jsx(Scraper, {});
});
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: home,
  meta
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-BFhZpkrh.js", "imports": ["/assets/chunk-HA7DTUK3-DItZKCSJ.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": true, "module": "/assets/root-CxH07KiY.js", "imports": ["/assets/chunk-HA7DTUK3-DItZKCSJ.js", "/assets/with-props-Db1jVSdq.js"], "css": ["/assets/root-DmqOZtHl.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "hydrateFallbackModule": void 0 }, "routes/home": { "id": "routes/home", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/home-BWHId_x9.js", "imports": ["/assets/with-props-Db1jVSdq.js", "/assets/chunk-HA7DTUK3-DItZKCSJ.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-1f68a1a4.js", "version": "1f68a1a4" };
const assetsBuildDirectory = "build\\client";
const basename = "/";
const future = { "unstable_optimizeDeps": false, "unstable_splitRouteModules": false, "unstable_viteEnvironmentApi": false };
const ssr = true;
const isSpaMode = false;
const prerender = [];
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/home": {
    id: "routes/home",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route1
  }
};
export {
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  prerender,
  publicPath,
  routes,
  ssr
};
