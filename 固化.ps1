$json = Get-Content "C:\Users\hpmax\Documents\trae_projects\tank_demo\models\固化\坦克v1.6配置_固化.json" -Raw -Encoding UTF8
$html = Get-Content "C:\Users\hpmax\Documents\trae_projects\tank_demo\model_factory.html" -Raw -Encoding UTF8
$html = $html -replace 'const T34_85_V16_CONFIG = \{[\s\S]*?\n\};', "const T34_85_V16_CONFIG = $json;"
Set-Content "C:\Users\hpmax\Documents\trae_projects\tank_demo\model_factory.html" $html -Encoding UTF8 -NoNewline
Write-Host "OK: T34_85_V16_CONFIG updated" -ForegroundColor Green
