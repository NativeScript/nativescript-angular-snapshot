global.__requireOverride = (function() {
    var map = {
/* __require-map__ */
    };

    function __join() {
        var parts = [];
        for (var i = 0, l = arguments.length; i < l; i++) {
            parts = parts.concat(arguments[i].split("/"));
        }
        var newParts = [];
        for (i = 0, l = parts.length; i < l; i++) {
            var part = parts[i];
            if (!part || part === ".") continue;
            if (part === "..") newParts.pop();
            else newParts.push(part);
        }
        if (parts[0] === "") newParts.unshift("");
        return newParts.join("/") || (newParts.length ? "/" : ".");
    }

    function __require(moduleId) {
        var moduleEntry = map[moduleId];
        if (!moduleEntry) {
            return;
        }

        return moduleEntry();
    }

    function __trace(message) {
        android.util.Log.v("TNS.Native", "" + message);
    }

    return function(moduleId, dirname) {
        while (global.__pendingJavaExtendCalls && __pendingJavaExtendCalls.length) {
            var extendCall = __pendingJavaExtendCalls.shift();
            extendCall();
        }

        moduleId = moduleId.replace(/^\.\/tns_modules\//, "");
        var module = __require(moduleId);
        if (module) {
            return module;
        }

        if (moduleId[0] === '.') {
            var resolvedModuleId = __join(dirname, moduleId).replace(/^\/.*\/files\/app\/tns_modules\//, '');
            module = __require(resolvedModuleId);
            if (module) {
                return module;
            }
        }
    };
}());