"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemControl = exports.SystemControlService = void 0;
var electron_1 = require("electron");
var child_process_1 = require("child_process");
var util_1 = require("util");
var systeminformation_1 = require("systeminformation");
var execAsync = (0, util_1.promisify)(child_process_1.exec);
var SystemControlService = /** @class */ (function () {
    function SystemControlService() {
    }
    /**
     * App Control: Launch application or URL
     */
    SystemControlService.prototype.launchApp = function (appTarget) {
        return __awaiter(this, void 0, void 0, function () {
            var cleanTarget, aliases, cmd, err_1, errorMsg;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cleanTarget = appTarget.trim().toLowerCase();
                        aliases = {
                            browser: 'start https://google.com',
                            chrome: 'start chrome',
                            edge: 'start msedge',
                            notepad: 'start notepad.exe',
                            calculator: 'start calc.exe',
                            calc: 'start calc.exe',
                            terminal: 'start wt.exe || start powershell.exe',
                            cmd: 'start cmd.exe',
                            settings: 'start ms-settings:',
                            explorer: 'start explorer.exe',
                            files: 'start explorer.exe',
                            spotify: 'start spotify:',
                            discord: 'start discord:',
                            taskmanager: 'start taskmgr.exe',
                        };
                        cmd = aliases[cleanTarget] || "start \"\" \"".concat(appTarget, "\"");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, execAsync(cmd, { shell: 'cmd.exe' })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, "Launched: ".concat(appTarget)];
                    case 3:
                        err_1 = _a.sent();
                        errorMsg = err_1 instanceof Error ? err_1.message : String(err_1);
                        return [2 /*return*/, "Failed to launch ".concat(appTarget, ": ").concat(errorMsg)];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * App Control: Focus active window by process/window title
     */
    SystemControlService.prototype.focusApp = function (target) {
        return __awaiter(this, void 0, void 0, function () {
            var psScript, stdout, err_2, errorMsg;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        psScript = "\n      $wshell = New-Object -ComObject WScript.Shell\n      $success = $wshell.AppActivate(\"".concat(target, "\")\n      if ($success) { \"OK\" } else { \"NOT_FOUND\" }\n    ");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, execAsync("powershell -NoProfile -Command \"".concat(psScript.replace(/\n/g, ' '), "\""))];
                    case 2:
                        stdout = (_a.sent()).stdout;
                        if (stdout.includes('OK')) {
                            return [2 /*return*/, "Focused window: ".concat(target)];
                        }
                        return [2 /*return*/, "Window not found or could not be focused: ".concat(target)];
                    case 3:
                        err_2 = _a.sent();
                        errorMsg = err_2 instanceof Error ? err_2.message : String(err_2);
                        return [2 /*return*/, "Error focusing ".concat(target, ": ").concat(errorMsg)];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * App Control: Terminate process by name
     */
    SystemControlService.prototype.terminateApp = function (processName) {
        return __awaiter(this, void 0, void 0, function () {
            var proc, err_3, errorMsg;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        proc = processName.trim();
                        if (!proc.endsWith('.exe') && !proc.includes('.')) {
                            proc += '.exe';
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, execAsync("taskkill /IM \"".concat(proc, "\" /F"), { shell: 'cmd.exe' })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, "Terminated: ".concat(proc)];
                    case 3:
                        err_3 = _a.sent();
                        errorMsg = err_3 instanceof Error ? err_3.message : String(err_3);
                        return [2 /*return*/, "Could not terminate ".concat(proc, ": ").concat(errorMsg)];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Audio & Media: Send media keyboard keys (Play/Pause, Next, Prev)
     */
    SystemControlService.prototype.mediaControl = function (action) {
        return __awaiter(this, void 0, void 0, function () {
            var vk, ps, err_4, errorMsg;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        vk = 0xcd;
                        if (action === 'next')
                            vk = 0xb0;
                        if (action === 'prev')
                            vk = 0xb1;
                        ps = "\n      Add-Type -TypeDefinition @\"\n      using System;\n      using System.Runtime.InteropServices;\n      public class MediaKey {\n          [DllImport(\"user32.dll\")]\n          public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);\n          public static void Press(byte vk) {\n              keybd_event(vk, 0, 0, UIntPtr.Zero);\n              keybd_event(vk, 0, 2, UIntPtr.Zero);\n          }\n      }\n\"@\n      [MediaKey]::Press(".concat(vk, ")\n    ");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, execAsync("powershell -NoProfile -Command \"".concat(ps.replace(/\n/g, ' '), "\""))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, "Media action executed: ".concat(action)];
                    case 3:
                        err_4 = _a.sent();
                        errorMsg = err_4 instanceof Error ? err_4.message : String(err_4);
                        return [2 /*return*/, "Failed to execute media action ".concat(action, ": ").concat(errorMsg)];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Audio & Media: Adjust or set master volume (0-100 or relative +/-)
     */
    SystemControlService.prototype.adjustVolume = function (levelOrDelta_1) {
        return __awaiter(this, arguments, void 0, function (levelOrDelta, isAbsolute) {
            var ps, stdout, match, percent, err_5, steps, vk, fallbackPs, fallbackErr_1, errorMsg;
            if (isAbsolute === void 0) { isAbsolute = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ps = "\n      Add-Type -TypeDefinition @\"\n      using System;\n      using System.Runtime.InteropServices;\n      [Guid(\"5CDF2C82-841E-4546-9722-0CF74078229A\"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]\n      public interface IAudioEndpointVolume {\n          int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);\n          int GetMasterVolumeLevelScalar(out float pfLevel);\n          int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, System.Guid pguidEventContext);\n          int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);\n      }\n      [Guid(\"D666063F-1587-4E43-81F1-B948E807363F\"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]\n      public interface IMMDevice {\n          int Activate(ref System.Guid id, int clsCtx, IntPtr pActivationParams, out IAudioEndpointVolume aev);\n      }\n      [Guid(\"A95664D2-9614-4F35-A746-DE8DB63617E6\"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]\n      public interface IMMDeviceEnumerator {\n          int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);\n      }\n      [ComImport, Guid(\"BCDE0395-E52F-467C-8E3D-C4579291692E\")]\n      public class MMDeviceEnumeratorComObj {}\n      public class VolumeHelper {\n          public static float ChangeVolume(float target, bool isAbsolute) {\n              var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObj());\n              IMMDevice speaker;\n              enumerator.GetDefaultAudioEndpoint(0, 1, out speaker);\n              var guid = typeof(IAudioEndpointVolume).GUID;\n              IAudioEndpointVolume vol;\n              speaker.Activate(ref guid, 23, IntPtr.Zero, out vol);\n              float current;\n              vol.GetMasterVolumeLevelScalar(out current);\n              float newVol = isAbsolute ? target : Math.Max(0.0f, Math.Min(1.0f, current + target));\n              vol.SetMasterVolumeLevelScalar(newVol, System.Guid.Empty);\n              return newVol;\n          }\n      }\n\"@\n      $res = [VolumeHelper]::ChangeVolume(".concat(levelOrDelta / 100, ", [bool]::Parse(\"").concat(isAbsolute, "\"))\n      Write-Output \"VOL:$res\"\n    ");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 8]);
                        return [4 /*yield*/, execAsync("powershell -NoProfile -Command \"".concat(ps.replace(/\n/g, ' '), "\""))];
                    case 2:
                        stdout = (_a.sent()).stdout;
                        match = stdout.match(/VOL:([0-9.]+)/);
                        if (match) {
                            percent = Math.round(parseFloat(match[1]) * 100);
                            return [2 /*return*/, "Volume set to ".concat(percent, "%")];
                        }
                        return [2 /*return*/, "Volume updated"];
                    case 3:
                        err_5 = _a.sent();
                        steps = Math.min(10, Math.max(1, Math.round(Math.abs(levelOrDelta) / 2)));
                        vk = levelOrDelta >= 0 ? 0xAF : 0xAE;
                        fallbackPs = "\n        Add-Type -TypeDefinition @\"\n        using System;\n        using System.Runtime.InteropServices;\n        public class VolKey {\n            [DllImport(\"user32.dll\")]\n            public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);\n        }\n\"@\n        1..".concat(steps, " | ForEach-Object {\n          [VolKey]::keybd_event(").concat(vk, ", 0, 0, [UIntPtr]::Zero)\n          [VolKey]::keybd_event(").concat(vk, ", 0, 2, [UIntPtr]::Zero)\n        }\n      ");
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, execAsync("powershell -NoProfile -Command \"".concat(fallbackPs.replace(/\n/g, ' '), "\""))];
                    case 5:
                        _a.sent();
                        return [2 /*return*/, "Volume adjusted by keyboard simulation"];
                    case 6:
                        fallbackErr_1 = _a.sent();
                        errorMsg = fallbackErr_1 instanceof Error ? fallbackErr_1.message : String(fallbackErr_1);
                        return [2 /*return*/, "Failed to adjust volume: ".concat(errorMsg)];
                    case 7: return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * System Metrics: Poll CPU, Memory, Disk, Battery, GPU
     */
    SystemControlService.prototype.getMetrics = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, load, mem, battery, fs, primaryDisk, memoryTotalGb, memoryUsedGb, diskTotalGb, diskUsedGb;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.all([
                            systeminformation_1.default.currentLoad().catch(function () { return ({ currentLoad: 0 }); }),
                            systeminformation_1.default.mem().catch(function () { return ({ total: 16e9, active: 8e9 }); }),
                            systeminformation_1.default.battery().catch(function () { return ({ hasBattery: false, percent: null, isCharging: false }); }),
                            systeminformation_1.default.fsSize().catch(function () { return ([{ size: 500e9, used: 250e9 }]); }),
                        ])];
                    case 1:
                        _a = _b.sent(), load = _a[0], mem = _a[1], battery = _a[2], fs = _a[3];
                        primaryDisk = fs[0] || { size: 1, used: 0 };
                        memoryTotalGb = parseFloat((mem.total / (Math.pow(1024, 3))).toFixed(1));
                        memoryUsedGb = parseFloat((mem.active / (Math.pow(1024, 3))).toFixed(1));
                        diskTotalGb = parseFloat((primaryDisk.size / (Math.pow(1024, 3))).toFixed(0));
                        diskUsedGb = parseFloat((primaryDisk.used / (Math.pow(1024, 3))).toFixed(0));
                        return [2 /*return*/, {
                                cpuUsage: Math.round(load.currentLoad),
                                memoryUsedGb: memoryUsedGb,
                                memoryTotalGb: memoryTotalGb,
                                memoryPercent: Math.round((mem.active / mem.total) * 100),
                                batteryPercent: battery.hasBattery ? battery.percent : null,
                                batteryCharging: battery.isCharging || false,
                                diskUsedGb: diskUsedGb,
                                diskTotalGb: diskTotalGb,
                                diskPercent: Math.round((primaryDisk.used / primaryDisk.size) * 100),
                                osName: 'Windows 11 / 10',
                            }];
                }
            });
        });
    };
    /**
     * Vision: Capture desktop screen as base64 JPEG
     */
    SystemControlService.prototype.captureScreen = function () {
        return __awaiter(this, void 0, void 0, function () {
            var sources, primaryScreen, image, size, dataUrl;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, electron_1.desktopCapturer.getSources({
                            types: ['screen'],
                            thumbnailSize: { width: 1920, height: 1080 },
                        })];
                    case 1:
                        sources = _a.sent();
                        if (sources.length === 0) {
                            throw new Error('No screen capture source found');
                        }
                        primaryScreen = sources[0];
                        image = primaryScreen.thumbnail;
                        size = image.getSize();
                        dataUrl = image.toDataURL();
                        return [2 /*return*/, {
                                dataUrl: dataUrl,
                                width: size.width,
                                height: size.height,
                            }];
                }
            });
        });
    };
    return SystemControlService;
}());
exports.SystemControlService = SystemControlService;
exports.systemControl = new SystemControlService();
