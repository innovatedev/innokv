# Changelog

All notable changes to this project will be documented in this file.

## v0.1.1

- fix default database and installation paths across operating systems
- display app/DB info on startup
- fix u8 record key display in database view
- fix entry UI/editor, add JSON editor tab for structure/values
- fix breadcrumb links
- fix initial load for root records
- fix treeview display for items with no sub keys

## v0.1.0

- jsr release

## v0.0.3

- jsr package

## v0.0.2

- unified cli and server
  - ./innokv db # drops to cli
  - ./innokv # starts server

## v0.0.1

- implemented KV database explorer
- Supports file based (sqlite) and remote (deno deploy and
  [seflhosted denokv](https://github.com/denoland/denokv)) deno kv stores
- Deno KV token authorization support
- Web server with deno fresh
- User accounts and permissions
- Binary releases for Linux, Windows and macOS
- CLI tool for managing databases

## v0.0.0

- Deno KV database explorer idea
