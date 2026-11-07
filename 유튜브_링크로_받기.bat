@echo off
chcp 65001 >nul
setlocal
rem ===== 유튜브 링크로 영상 받기 : 검수용 H.264 MP4로 저장 =====
rem 준비물: 이 bat와 같은 폴더에 yt-dlp.exe 와 ffmpeg.exe
set "YT=%~dp0yt-dlp.exe"
set "FF=%~dp0ffmpeg.exe"
if not exist "%YT%" (
  echo yt-dlp.exe 가 이 폴더에 없어요.
  echo   https://github.com/yt-dlp/yt-dlp/releases/latest  에서 yt-dlp.exe 를 받아 이 bat 옆에 넣어 주세요.
  pause
  exit /b 1
)
if not exist "%FF%" (
  echo ffmpeg.exe 가 이 폴더에 없어요. 영상과 소리를 합치는 데 필요해요.
  echo   https://www.gyan.dev/ffmpeg/builds/  의 ffmpeg-release-essentials.zip 안 bin\ffmpeg.exe 를 이 bat 옆에 넣어 주세요.
  pause
  exit /b 1
)
set "URL=%~1"
if "%URL%"=="" set /p "URL=유튜브 링크를 붙여 넣고 Enter: "
if "%URL%"=="" exit /b 0
if not exist "%~dp0받은영상" mkdir "%~dp0받은영상"
echo.
echo ===== 내려받는 중 (최대 1080p, H.264 MP4) =====
"%YT%" --ffmpeg-location "%FF%" -f "bv*[vcodec^=avc1][height<=1080]+ba[acodec^=mp4a]/b[ext=mp4]/b" --merge-output-format mp4 -o "%~dp0받은영상\%%(title)s.%%(ext)s" "%URL%"
if errorlevel 1 (
  echo.
  echo 실패했어요. 링크가 '일부공개'(비공개 아님)인지 확인해 주세요.
  echo 계속 실패하면 yt-dlp 를 최신으로 올려 보세요: 이 폴더에서  yt-dlp.exe -U
) else (
  echo.
  echo 끝. '받은영상' 폴더에 저장됐어요. 이 파일을 영상검수.html 에 끌어다 놓으세요.
  start "" "%~dp0받은영상"
)
pause
