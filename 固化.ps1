$json = Get-Content "c:\Users\hpmax\Documents\trae_projects\坦克demo\tank_demo\models\固化\坦克v1.6配置_固化.json" -Raw -Encoding UTF8

# 同步到 model_factory.html
$html = Get-Content "c:\Users\hpmax\Documents\trae_projects\坦克demo\tank_demo\model_factory.html" -Raw -Encoding UTF8
$html = $html -replace 'const T34_85_V16_CONFIG = \{[\s\S]*?\n\};', "const T34_85_V16_CONFIG = $json;"
Set-Content "c:\Users\hpmax\Documents\trae_projects\坦克demo\tank_demo\model_factory.html" $html -Encoding UTF8 -NoNewline

# 同步到 models/t34_v16_builder.js
$builder = Get-Content "c:\Users\hpmax\Documents\trae_projects\坦克demo\tank_demo\models\t34_v16_builder.js" -Raw -Encoding UTF8
$builder = $builder -replace 'const T34_85_V16_CONFIG = \{[\s\S]*?\};', "const T34_85_V16_CONFIG = $json;"
Set-Content "c:\Users\hpmax\Documents\trae_projects\坦克demo\tank_demo\models\t34_v16_builder.js" $builder -Encoding UTF8 -NoNewline

Write-Host "OK: T34_85_V16_CONFIG synced to model_factory.html + t34_v16_builder.js" -ForegroundColor Green
