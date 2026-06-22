# Claude Code tray notification - non-blocking, auto-dismiss 5s
# Usage: powershell -ExecutionPolicy Bypass -File notify.ps1 "Title" "Message"
# v2: ASCII-safe, no Chinese chars in script body (params passed from JS)

param(
  [string]$Title = "Claude Code",
  [string]$Message = "Task complete"
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$notif = New-Object System.Windows.Forms.NotifyIcon
$notif.Icon = [System.Drawing.SystemIcons]::Information
$notif.BalloonTipTitle = $Title
$notif.BalloonTipText = $Message
$notif.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
$notif.Visible = $true
$notif.ShowBalloonTip(5000)

# Keep alive long enough for balloon to show
Start-Sleep -Seconds 6
$notif.Dispose()
