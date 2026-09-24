import { ROOMS as PROLOGUE } from "./data/prologue.js";

// 浏览器与无 DOM 测试共用同一份注册表和加载流程。
export const CHAPTERS = [
  { id: "prologue", rooms: PROLOGUE, preload: true },
  { id: "wabe", loader: () => import("./data/wabe.js") },
  { id: "japan", loader: () => import("./data/japan.js") },
  { id: "underground", loader: () => import("./data/underground.js") },
  { id: "orbit", loader: () => import("./data/orbit.js") },
  { id: "pacific", loader: () => import("./data/pacific.js") },
  { id: "tundra", loader: () => import("./data/tundra.js") },
  { id: "islet", loader: () => import("./data/islet.js") },
  { id: "desert", loader: () => import("./data/desert.js") },
  { id: "ranch", loader: () => import("./data/ranch.js") },
  { id: "finale", loader: () => import("./data/finale.js") },
];

export function createChapterSource() {
  const registry = new Map(CHAPTERS.map((chapter) => [chapter.id, chapter]));
  const preloaded = CHAPTERS.filter((chapter) => chapter.preload === true);
  return {
    rooms: Object.assign({}, ...preloaded.map((chapter) => chapter.rooms)),
    preloadedChapters: preloaded.map((chapter) => chapter.id),
    async chapterLoader(id) {
      const chapter = registry.get(id);
      if (!chapter) return null;
      return chapter.rooms || (await chapter.loader()).ROOMS;
    },
  };
}
