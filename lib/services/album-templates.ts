/**
 * 册谱系统章节的"模板回退文案"（纯函数，可单测）。
 *
 * 当用户没有为凡例 / 姓氏源流 / 跋等章节填写自定义正文时，渲染器用这里的文案。
 * 抽出来是为了让屏幕/打印（components/album/CompletePages.tsx）与 PDF
 * （lib/pdf/album.tsx）两端共享同一份文字，避免各写一遍而漂移。
 */
import type { AlbumBook } from "@/lib/services/album";

/** 凡例条目（与改造前 CompletePages.fanliPage 文案一致）。 */
export function fanliItems(book: AlbumBook, compilerCount: number): string[] {
  const surname = book.family.surname;
  const founderName = book.family.founderName;
  return [
    `本谱奉 ${surname} 氏${founderName ? `始祖 ${founderName} 公` : "始祖"}为本族一世。`,
    "《世系图录》图录配对：每张吊线图（仅列男系、五世为一图）之后，紧附其欧式详录。",
    "详录以横排欧式编排，每人详其字号、生卒、配偶（妻氏）等，与前页吊线图一一对应。",
    "字辈派语载于《字辈表》一节。如本族无字辈传承，则取人物生年之先后为序。",
    `本谱由本族修谱人员 ${compilerCount} 人共同修撰，详见《修谱人员名录》。`,
    `本谱共收入族人 ${book.totalPersons} 名，分 ${book.volumes.length} 卷。`,
    "本谱采用现代简体字录入，原谱繁体或异体字以注释形式保留。",
    "凡未载录或暂时存疑之处，留待续修补正。",
  ];
}

export type YuanliuContent =
  | { kind: "custom"; text: string }
  | { kind: "template"; paragraphs: string[]; note: string };

/** 姓氏源流：用户填了 surnameOrigin 用之，否则用模板段落（与 CompletePages.yuanliuPage 一致）。 */
export function yuanliuContent(book: AlbumBook): YuanliuContent {
  if (book.family.surnameOrigin) {
    return { kind: "custom", text: book.family.surnameOrigin };
  }
  const surname = book.family.surname;
  const founder = book.family.founderName;
  const p1 =
    `${surname} 氏，源远流长。${surname} 之得姓，载于经传，蕃衍于历代。` +
    (founder
      ? `本族始祖 ${founder} 公开基本支，传衍至今。`
      : "本族始祖之事迹，载于本谱卷一卷二。");
  const p2 =
    "数百年来，族人散居各地，或务农、或经商、或读书入仕，" +
    "各有功业。今值续修家谱，特为本族世系正本清源，" +
    "俾后世子孙知所自来、知所归依。";
  const note =
    "按：本节为本谱自动生成的源流概述。可在族谱设置中填入具体源流故事，本节将以其内容代之。";
  return { kind: "template", paragraphs: [p1, p2], note };
}

export interface PostscriptContent {
  paragraphs: string[];
  date: string;
}

/** 跋（与 CompletePages.baPage 一致）。 */
export function postscriptContent(book: AlbumBook): PostscriptContent {
  const d = new Date(book.generatedAt);
  return {
    paragraphs: [
      `${book.family.name} 之续修，${book.totalPersons} 人之名讳俱列，${book.volumes.length} 卷之事迹悉收。` +
        "自来族谱，所以序昭穆、明亲疏、垂久远，俾后裔知所自出、敬其所宗。",
      "本谱以族谱·家系统编纂，凡有疏漏，留待续修补正。",
    ],
    date: `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`,
  };
}
