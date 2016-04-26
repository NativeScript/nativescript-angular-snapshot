#!/usr/bin/env python

import sys
import os
import json
import shutil
from subprocess import call

def generate_require_statement(relativeRootPath, file):
	path_map = []
	if file.endswith(".js"):
		relativePath = os.path.join(relativeRootPath, file).replace("\\", '/');
		path_map.append('		"./tns_modules/' + relativePath + '": () => require("' + relativePath + '"),\n')
		path_map.append('		"' + relativePath[:-len(".js")] + '": () => require("' + relativePath + '"),\n');
		path_map.append('		"' + relativePath + '": () => require("' + relativePath + '"),\n');
	elif file == "package.json":
		with open('dist/webpack.records.json') as data_file:
			data = json.load(data_file)

		if "main" in data:
			path_map.append('		"' + relativeRootPath + '": () => require("' + relativeRootPath + '"),\n')
			path_map.append('		"' + relativeRootPath + "/" + '": () => require("' + relativeRootPath + '"),\n')

	return path_map

def add_angular_dependencies(path_map):
	with open('dist/webpack.records.json') as data_file:
		data = json.load(data_file)

	angular_included_scripts = data["modules"]["byIdentifier"]
	for angular_script_path in angular_included_scripts:
		if "angular_bundle_scripts" not in angular_script_path and "webpack" not in angular_script_path:
			path_map.extend(generate_require_statement("", angular_script_path))

def generate_require_override():
	prefix = "global.__requireOverride = function(moduleId) {\n\
	var map = { \n"

	suffix = "	};\n\
	var module;\n\
	var moduleEntry = map[moduleId];\n\
	if (moduleEntry) {\n\
		module = moduleEntry();\n\
		if (module && module.evalLazy) {\n\
			module.evalLazy();\n\
			delete module.evalLazy();\n\
		}\n\
	}\n\
	return module;\
};";

	path_map = []
	rootPath = sys.argv[1]
	exclude = set(["angular2", "rxjs", "zone.js", "reflect-metadata", "querystring", "parse5", "es6-shim", "es6-promise"])

	add_angular_dependencies(path_map);

	for root, dirs, files in os.walk(rootPath, topdown=True):
		dirs[:] = [d for d in dirs if d not in exclude]
		for file in files:
			relativeRootPath = root[len(rootPath):]
			path_map.extend(generate_require_statement(relativeRootPath, file))

	path_map.sort();
	return prefix + ' '.join(map(str, path_map)) + suffix

if __name__ == "__main__":
	if len(sys.argv) < 2:
		print "Location to precompiled tns_modules is missing"
		sys.exit(2)
	call(["webpack", "--config", "angular.webpack.config.js", "--root", sys.argv[1]]);

	require_override = generate_require_override()

	shutil.copy("starter.js", "dist/starter.js")
	with open("dist/starter.js", "a") as starter:
		starter.write(require_override)

	call(["webpack", "--root", sys.argv[1]]);

	with open("dist/bundle.js", "w+b") as to_file:
		with open("dist/ns_bundle.js", "r+b") as from_file:
			from_file.readline() 
			with open("static_content.js") as static_content:
				to_file.writelines(static_content)
			to_file.write("\nexports = \n")
			shutil.copyfileobj(from_file, to_file)

	print "Successfully created dist/bundle.js"