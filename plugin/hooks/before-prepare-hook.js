var path = require("path");
var fs = require("fs");
var shelljs = require("shelljs");
var semver = require("semver");
var common = require("./common");

var MIN_ANDROID_RUNTIME_VERSION_WITH_SNAPSHOT_SUPPORT = "2.1.0";

function cleanSnapshotData(platformAppDirectory, projectData, snapshotPackageName) {
    // Force the CLI to return the deleted packages
    if (!shelljs.test("-e", path.join(platformAppDirectory, "tns_modules/application")) ||
        !shelljs.test("-e", path.join(platformAppDirectory, "tns_modules/tns-core-modules/application"))) {
        shelljs.touch("-c", path.join(projectData.projectDir, "node_modules/nativescript-angular/package.json"));
        shelljs.touch("-c", path.join(projectData.projectDir, "node_modules/tns-core-modules/package.json"));
    }

    shelljs.rm("-rf", path.join(platformAppDirectory, "_embedded_script_.js"));
    shelljs.rm("-rf", path.join(platformAppDirectory, "../snapshots"));

    var pluginDirectory = path.join(projectData.projectDir, "node_modules", snapshotPackageName);
    var pluginLibsPath = path.join(pluginDirectory, "platforms/android/jniLibs")
    if (shelljs.test("-e", pluginLibsPath)) {
        shelljs.mv("-f", pluginLibsPath, path.join(path.join(pluginDirectory, "platforms/android/jniLibs-ignore")));
    }
}

function restoreSnapshotLibs(projectData, snapshotPackageName) {
    var pluginDirectory = path.join(projectData.projectDir, "node_modules", snapshotPackageName);
    var pluginLibsIgnoredPath = path.join(pluginDirectory, "platforms/android/jniLibs-ignore")
    if (shelljs.test("-e", pluginLibsIgnoredPath)) {
        shelljs.mv("-f", pluginLibsIgnoredPath, path.join(path.join(pluginDirectory, "platforms/android/jniLibs")));
    }
}

module.exports = function(logger, platformsData, projectData, hookArgs) {
    var platformName = hookArgs.platform.toLowerCase();

    if (platformName !== "android" && !projectData.$options.release) {
        return;
    }

    common.executeInProjectDir(projectData.projectDir, function() {
        var androidPlatformData = platformsData.platformsData[platformName];
        var platformAppDirectory = path.join(androidPlatformData.appDestinationDirectoryPath, "app");

        if (!common.isSnapshotEnabled(projectData, hookArgs)) {
            if (platformName === "android") {
                cleanSnapshotData(platformAppDirectory, projectData, "tns-core-modules-snapshot");
                cleanSnapshotData(platformAppDirectory, projectData, "nativescript-angular-snapshot");
            }
            return;
        }

        var currentRuntimeVersion = common.getAndroidRuntimeVersion(projectData, androidPlatformData);
        if (!currentRuntimeVersion) {
            throw new Error("In order to download a compatible V8 snapshot you must have the \"android\" platform installed - to do so please run \"tns platform add android\".");
        }

        // The version could be "next"
        if (semver.valid(currentRuntimeVersion)) {
            if (!semver.gte(currentRuntimeVersion, MIN_ANDROID_RUNTIME_VERSION_WITH_SNAPSHOT_SUPPORT)) {
                throw new Error("In order to support heap snapshots, you must have at least tns-android@" + MIN_ANDROID_RUNTIME_VERSION_WITH_SNAPSHOT_SUPPORT +
                    " installed. Current Android Runtime version is: " + currentRuntimeVersion + ".");
            }
        }

        var isAngularApp = common.isAngularInstalled(projectData);
        var requiredSnapshotPackage = common.getSnapshotPackage(projectData, androidPlatformData, isAngularApp);

        if (!isAngularApp) {
            common.uninstallPackage({ name: "nativescript-angular-snapshot" });
        } else {
            common.uninstallPackage({ name: "tns-core-modules-snapshot" });
        }

        if (!common.isPackageInstalled(requiredSnapshotPackage)) {
            logger.warn("Required heap snapshot package is not installed. Installing \"" + requiredSnapshotPackage.name + "@" + requiredSnapshotPackage.version + "\".");

            if (!common.isPackagePublished(requiredSnapshotPackage)) {
                logger.warn("Could not find package \"" + requiredSnapshotPackage.name + "@" + requiredSnapshotPackage.version + "\" in the registry.\n" +
                    "Build will now continue without using heap snapshots ...");

                cleanSnapshotData(platformAppDirectory, projectData, requiredSnapshotPackage.name);

                return;
            }

            common.installPublishedPackage(logger, requiredSnapshotPackage);
        }

        restoreSnapshotLibs(projectData, requiredSnapshotPackage.name);
    });
};
