[CmdletBinding()]
param(
    [string]$InstallRoot = '',
    [switch]$NoShortcuts,
    [switch]$NoLaunch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
    Write-Host "  $Message" -ForegroundColor Green
}

function Copy-FolderSafely([string]$Source, [string]$Destination) {
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    & robocopy.exe $Source $Destination /E /R:1 /W:1 /COPY:DAT /DCOPY:DAT /NFL /NDL /NJH /NJS /NP /XD __pycache__ backups_instalador .git _descartados /XF *.pyc _codex_* | Out-Null
    $copyCode = $LASTEXITCODE
    if ($copyCode -ge 8) {
        throw "Falha ao copiar os arquivos (codigo $copyCode)."
    }
}

try {
    $source = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
    $backup = $null
    if ([string]::IsNullOrWhiteSpace($InstallRoot) -and [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        throw 'O Windows nao informou a pasta LOCALAPPDATA.'
    }

    $baseFolder = if ([string]::IsNullOrWhiteSpace($InstallRoot)) { $env:LOCALAPPDATA } else { $InstallRoot }
    $localRoot = [IO.Path]::GetFullPath($baseFolder).TrimEnd([IO.Path]::DirectorySeparatorChar)
    $target = [IO.Path]::GetFullPath((Join-Path $localRoot 'SEG Vendas'))
    if (-not $target.StartsWith($localRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'A pasta de instalacao nao e segura.'
    }

    $bundledPython = Join-Path $source 'runtime\python.exe'
    $pythonLauncher = if (Test-Path -LiteralPath $bundledPython) { $bundledPython } else { Get-Command py.exe -ErrorAction SilentlyContinue }
    if (-not $pythonLauncher) { $pythonLauncher = Get-Command python.exe -ErrorAction SilentlyContinue }
    if (-not $pythonLauncher) {
        throw 'Python 3 nao foi encontrado. Instale o Python 3 para Windows e execute este instalador novamente.'
    }

    $sameFolder = $source.Equals($target, [StringComparison]::OrdinalIgnoreCase)
    if (-not $sameFolder) {
        if (Test-Path -LiteralPath $target) {
            $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
            $backup = Join-Path $target (Join-Path 'backups_instalador' $stamp)
            Write-Step 'Protegendo as bases da instalacao anterior...'
            foreach ($folderName in @('data', 'manuais')) {
                $existingFolder = Join-Path $target $folderName
                if (Test-Path -LiteralPath $existingFolder) {
                    Copy-FolderSafely $existingFolder (Join-Path $backup $folderName)
                }
            }
        }

        Write-Step 'Copiando o SEG Vendas para a pasta do usuario...'
        Copy-FolderSafely $source $target

        if ($backup -and (Test-Path -LiteralPath $backup)) {
            Write-Step 'Restaurando clientes, usuarios, fotos e manuais...'
            foreach ($folderName in @('data', 'manuais')) {
                $savedFolder = Join-Path $backup $folderName
                if (Test-Path -LiteralPath $savedFolder) {
                    Copy-FolderSafely $savedFolder (Join-Path $target $folderName)
                }
            }
        }
    }

    $startFile = Join-Path $target 'abrir_seg_vendas.bat'
    $networkConfigFile = Join-Path $target 'scripts\CONFIGURAR_REDE_BETA.bat'
    if (-not (Test-Path -LiteralPath $startFile)) {
        throw 'O arquivo abrir_seg_vendas.bat nao foi encontrado apos a instalacao.'
    }
    if (-not (Test-Path -LiteralPath $networkConfigFile)) {
        throw 'O arquivo CONFIGURAR_REDE_BETA.bat nao foi encontrado apos a instalacao.'
    }

    if (-not $NoShortcuts) {
        Write-Step 'Criando atalhos...'
        $shell = New-Object -ComObject WScript.Shell
        $desktop = [Environment]::GetFolderPath('Desktop')
        $programs = [Environment]::GetFolderPath('Programs')
        $startMenuFolder = Join-Path $programs 'SEG Vendas'
        New-Item -ItemType Directory -Path $startMenuFolder -Force | Out-Null

        foreach ($shortcutPath in @(
            (Join-Path $desktop 'SEG Vendas.lnk'),
            (Join-Path $startMenuFolder 'SEG Vendas.lnk')
        )) {
            $shortcut = $shell.CreateShortcut($shortcutPath)
            $shortcut.TargetPath = $startFile
            $shortcut.WorkingDirectory = $target
    $shortcut.Description = 'Abrir SEG Vendas 5.9.13'
            $shortcut.IconLocation = (Join-Path $target 'assets\seg-vendas.ico') + ',0'
            $shortcut.Save()
        }

        foreach ($shortcutPath in @(
            (Join-Path $desktop 'Configurar rede SEG Vendas.lnk'),
            (Join-Path $startMenuFolder 'Configurar rede SEG Vendas.lnk')
        )) {
            $shortcut = $shell.CreateShortcut($shortcutPath)
            $shortcut.TargetPath = $networkConfigFile
            $shortcut.WorkingDirectory = $target
            $shortcut.Description = 'Configurar IP, porta e endereco publico do SEG Vendas'
            $shortcut.IconLocation = "$env:SystemRoot\System32\SHELL32.dll,18"
            $shortcut.Save()
        }
    }

    Write-Step "Instalado em: $target"
    if (-not $NoLaunch) {
        Write-Step 'Abrindo o SEG Vendas...'
        Start-Process -FilePath $startFile -WorkingDirectory $target
    }
    exit 0
}
catch {
    Write-Host "  ERRO: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
