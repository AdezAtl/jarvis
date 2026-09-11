param(
    [string]$action = 'play_pause',
    [int]$count = 1
)

$code = @"
using System;
using System.Runtime.InteropServices;
public class NativeKeys {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    public static void SendKey(byte vk, int times) {
        for (int i = 0; i < times; i++) {
            keybd_event(vk, 0, 0, UIntPtr.Zero);
            keybd_event(vk, 0, 2, UIntPtr.Zero);
        }
    }
}
"@

if (-not ([System.Management.Automation.PSTypeName]'NativeKeys').Type) {
    Add-Type -TypeDefinition $code
}

switch ($action.ToLower()) {
    'play_pause'  { [NativeKeys]::SendKey(0xCD, 1); Write-Output "Media: Play/Pause toggled" }
    'next'        { [NativeKeys]::SendKey(0xB0, 1); Write-Output "Media: Next Track" }
    'prev'        { [NativeKeys]::SendKey(0xB1, 1); Write-Output "Media: Previous Track" }
    'volume_up'   { [NativeKeys]::SendKey(0xAF, [Math]::Max(1, $count)); Write-Output "Volume: Up $count steps" }
    'volume_down' { [NativeKeys]::SendKey(0xAE, [Math]::Max(1, $count)); Write-Output "Volume: Down $count steps" }
    'volume_mute' { [NativeKeys]::SendKey(0xAD, 1); Write-Output "Volume: Mute toggled" }
    default       { Write-Output "Unknown action: $action" }
}
