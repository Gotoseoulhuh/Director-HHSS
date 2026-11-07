@echo off
chcp 65001 >nul
setlocal
rem ===== H.264 MP4 변환기 : 영상 파일을 이 bat 파일 위에 끌어다 놓으세요 =====
set "FF=ffmpeg"
if exist "%~dp0ffmpeg.exe" set "FF=%~dp0ffmpeg.exe"
"%FF%" -version >nul 2>&1
if errorlevel 1 (
  echo ffmpeg 를 찾을 수 없어요.
  echo   1^) https://www.gyan.dev/ffmpeg/builds/  에서 ffmpeg-release-essentials.zip 을 받고
  echo   2^) 압축 안의 bin\ffmpeg.exe 를 이 bat 파일과 같은 폴더에 넣어 주세요.
  pause
  exit /b 1
)
if "%~1"=="" (
  echo 영상 파일을 이 bat 파일 위에 끌어다 놓으면 같은 폴더에 _H264.mp4 로 저장됩니다.
  pause
  exit /b 0
)
for %%F in (%*) do (
  echo.
  echo ===== 변환 중: %%~nxF
  "%FF%" -v error -stats -y -i "%%~F" -c:v libx264 -preset veryfast -crf 21 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart "%%~dpnF_H264.mp4"
)
echo.
echo 끝. 원본과 같은 폴더에 _H264.mp4 파일이 생겼어요.
pause
