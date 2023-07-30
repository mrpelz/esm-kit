include node_modules/@mrpelz/boilerplate/config/Makefile

util_mark_executable:
	chmod +x dist/cli/*.js

transform_prod: util_clear transform_typescript util_mark_executable
