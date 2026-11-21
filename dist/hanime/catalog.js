"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.genres = exports.catalog = void 0;
const catalog = [{
  title: "New Releases",
  filter: "order_by=released_at_unix&ordering=desc"
}, {
  title: "Recent Uploads",
  filter: "order_by=created_at_unix&ordering=desc"
}, {
  title: "Trending Monthly",
  filter: "trending:month"
}, {
  title: "Trending Weekly",
  filter: "trending:week"
}, {
  title: "Most Viewed",
  filter: "order_by=views&ordering=desc"
}, {
  title: "Most Liked",
  filter: "order_by=likes&ordering=desc"
}];
exports.catalog = catalog;
const genres = [{
  title: "Uncensored",
  filter: "tag:uncensored"
}, {
  title: "1080p HD",
  filter: "tag:1080p"
}, {
  title: "Vanilla",
  filter: "tag:vanilla"
}, {
  title: "Romance",
  filter: "tag:romance"
}, {
  title: "Harem",
  filter: "tag:harem"
}, {
  title: "Fantasy",
  filter: "tag:fantasy"
}, {
  title: "School Girls",
  filter: "tag:school girls"
}, {
  title: "MILF",
  filter: "tag:milf"
}, {
  title: "Succubus",
  filter: "tag:succubus"
}, {
  title: "Elf",
  filter: "tag:elf"
}, {
  title: "Maid",
  filter: "tag:maid"
}, {
  title: "NTR / Netorare",
  filter: "tag:netorare"
}, {
  title: "Yuri",
  filter: "tag:yuri"
}, {
  title: "Ahegao",
  filter: "tag:ahegao"
}, {
  title: "Big Boobs",
  filter: "tag:big boobs"
}, {
  title: "Creampie",
  filter: "tag:creampie"
}];
exports.genres = genres;
