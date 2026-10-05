@echo off
title Trust Jupsoft Shortly Local SSL Certificate
color 0b
echo ======================================================================
echo    Jupsoft Shortly - Install Local SSL Certificate into Windows
echo ======================================================================
echo.
echo Installing Local Root CA into Windows Trusted Root Store...
certutil -user -addstore Root "%~dp0backend-nestjs\certs\rootCA.crt"
echo.
echo ======================================================================
echo  Done! Please refresh or restart your Chrome browser.
echo  https://helloworld.2bd.net will now show Secure with a green lock!
echo ======================================================================
echo.
pause
