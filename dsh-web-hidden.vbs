' Start dsh web in a hidden window (no console window, runs detached).
' Double-click this file, or use it for auto-start at logon.
' Note: starts a second instance if one is already running (port conflict).
Set sh = CreateObject("WScript.Shell")
sh.Run "cmd /c dsh web", 0, False
