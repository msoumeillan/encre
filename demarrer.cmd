@echo off
REM ─────────────────────────────────────────────
REM  Encre — lance le carnet dans le navigateur
REM ─────────────────────────────────────────────
cd /d "%~dp0"
echo.
echo   Encre demarre sur http://localhost:5173
echo   Laissez cette fenetre ouverte pendant l'utilisation.
echo   Ctrl+C pour arreter.
echo.
python serveur.py
if errorlevel 1 (
  echo.
  echo   Echec du lancement. Repli sur le serveur simple
  echo   ^(les fiches Letterboxd ne seront pas remplies automatiquement^).
  echo.
  start "" http://localhost:5173
  python -m http.server 5173
)
