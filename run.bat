@echo off
setlocal
set GODOT=%LOCALAPPDATA%\Microsoft\WinGet\Packages\GodotEngine.GodotEngine_Microsoft.Winget.Source_8wekyb3d8bbwe\Godot_v4.7.2-stable_win64.exe
if not exist "%GODOT%" (
  where godot >nul 2>&1 && set GODOT=godot
)
if not exist "%GODOT%" if not "%GODOT%"=="godot" (
  echo Godot 4.7 not found. Install via: winget install GodotEngine.GodotEngine
  exit /b 1
)
"%GODOT%" --path "%~dp0"
