[CmdletBinding()]
param(
    [string]$InstallRoot = '',
    [switch]$NoShortcuts,
    [switch]$NoLaunch
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:SourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$script:TargetRoot = $null
$script:BackupRoot = $null
$script:LogFile = Join-Path $env:TEMP "seg_vendas_install_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"

function Write-Log([string]$Message) {
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    "[$timestamp] $Message" | Out-File -FilePath $script:LogFile -Append -Encoding UTF8
}

function Copy-FolderSafely([string]$Source, [string]$Destination) {
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    & robocopy.exe $Source $Destination /E /R:1 /W:1 /COPY:DAT /DCOPY:DAT /NFL /NDL /NJH /NJS /NP /XD __pycache__ backups_instalador .git _descartados /XF *.pyc _codex_* | Out-Null
    $copyCode = $LASTEXITCODE
    if ($copyCode -ge 8) {
        throw "Falha ao copiar os arquivos (código $copyCode)."
    }
}

$installerForm = New-Object System.Windows.Forms.Form
$installerForm.Text = "Instalador SEG Vendas 5.9.14"
$installerForm.Size = New-Object System.Drawing.Size(500, 350)
$installerForm.StartPosition = "CenterScreen"
$installerForm.FormBorderStyle = "FixedDialog"
$installerForm.MaximizeBox = $false
try {
    $installerForm.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon((Join-Path $script:SourceRoot "assets\seg-vendas.ico"))
} catch {
    # Continua sem ícone se não for possível carregar
}

$progressBar = New-Object System.Windows.Forms.ProgressBar
$progressBar.Location = New-Object System.Drawing.Point(20, 200)
$progressBar.Size = New-Object System.Drawing.Size(440, 25)
$progressBar.Style = "Continuous"
$installerForm.Controls.Add($progressBar)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Location = New-Object System.Drawing.Point(20, 240)
$statusLabel.Size = New-Object System.Drawing.Size(440, 20)
$statusLabel.Text = "Inicializando..."
$installerForm.Controls.Add($statusLabel)

$logLabel = New-Object System.Windows.Forms.Label
$logLabel.Location = New-Object System.Drawing.Point(20, 270)
$logLabel.Size = New-Object System.Drawing.Size(440, 60)
$logLabel.Text = ""
$logLabel.Font = New-Object System.Drawing.Font("Segoe UI", 8)
$installerForm.Controls.Add($logLabel)

$logoPictureBox = New-Object System.Windows.Forms.PictureBox
$logoPictureBox.Location = New-Object System.Drawing.Point(20, 20)
$logoPictureBox.Size = New-Object System.Drawing.Size(460, 150)
$logoPictureBox.SizeMode = "StretchImage"
try {
    $logoPictureBox.Image = [System.Drawing.Image]::FromFile((Join-Path $script:SourceRoot "assets\logo-seg.png"))
} catch {
    # Continua sem logo se não for possível carregar
}
$installerForm.Controls.Add($logoPictureBox)

$installerForm.Add_Shown({
    $installerForm.Activate()
    $progressBar.Value = 10
    $statusLabel.Text = "Verificando requisitos..."
    $logLabel.Text = "Verificando Python..."
    $installerForm.Refresh()
    Start-Sleep -Milliseconds 500
})

$installerForm.Show()

try {
    Write-Log "Iniciando instalação SEG Vendas 5.9.14"
    Write-Log "Origem: $script:SourceRoot"

    $progressBar.Value = 20
    $statusLabel.Text = "Verificando Python..."
    $logLabel.Text = "Procurando Python 3..."
    $installerForm.Refresh()
    Start-Sleep -Milliseconds 500

    $bundledPython = Join-Path $script:SourceRoot 'runtime\python.exe'
    $pythonLauncher = if (Test-Path -LiteralPath $bundledPython) { $bundledPython } else { Get-Command py.exe -ErrorAction SilentlyContinue }
    if (-not $pythonLauncher) { $pythonLauncher = Get-Command python.exe -ErrorAction SilentlyContinue }
    if (-not $pythonLauncher) {
        throw 'Python 3 não foi encontrado. Instale o Python 3 para Windows e execute este instalador novamente.'
    }
    Write-Log "Python encontrado: $pythonLauncher"

    $progressBar.Value = 30
    $statusLabel.Text = "Determinando pasta de instalação..."
    $logLabel.Text = "Verificando LOCALAPPDATA..."
    $installerForm.Refresh()
    Start-Sleep -Milliseconds 500

    if ([string]::IsNullOrWhiteSpace($InstallRoot) -and [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        throw 'O Windows não informou a pasta LOCALAPPDATA.'
    }

    $baseFolder = if ([string]::IsNullOrWhiteSpace($InstallRoot)) { $env:LOCALAPPDATA } else { $InstallRoot }
    $localRoot = [IO.Path]::GetFullPath($baseFolder).TrimEnd([IO.Path]::DirectorySeparatorChar)
    $target = [IO.Path]::GetFullPath((Join-Path $localRoot 'SEG Vendas'))
    if (-not $target.StartsWith($localRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'A pasta de instalação não é segura.'
    }
    $script:TargetRoot = $target
    Write-Log "Pasta de destino: $target"

    $progressBar.Value = 40
    $statusLabel.Text = "Verificando instalação anterior..."
    $logLabel.Text = "Protegendo dados..."
    $installerForm.Refresh()
    Start-Sleep -Milliseconds 500

    $sameFolder = $script:SourceRoot.Equals($target, [StringComparison]::OrdinalIgnoreCase)
    if (-not $sameFolder) {
        if (Test-Path -LiteralPath $target) {
            $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
            $backup = Join-Path $target (Join-Path 'backups_instalador' $stamp)
            $script:BackupRoot = $backup
            Write-Log "Backup anterior em: $backup"

            $progressBar.Value = 50
            $statusLabel.Text = "Protegendo dados anteriores..."
            $logLabel.Text = "Copiando data e manuais..."
            $installerForm.Refresh()
            Start-Sleep -Milliseconds 500

            foreach ($folderName in @('data', 'manuais')) {
                $existingFolder = Join-Path $target $folderName
                if (Test-Path -LiteralPath $existingFolder) {
                    Copy-FolderSafely $existingFolder (Join-Path $backup $folderName)
                    Write-Log "Backup de $folderName concluído"
                }
            }
        }

        $progressBar.Value = 60
        $statusLabel.Text = "Copiando arquivos..."
        $logLabel.Text = "Copiando SEG Vendas..."
        $installerForm.Refresh()
        Start-Sleep -Milliseconds 500

        Copy-FolderSafely $script:SourceRoot $target
        Write-Log "Arquivos copiados para: $target"

        if ($script:BackupRoot -and (Test-Path -LiteralPath $script:BackupRoot)) {
            $progressBar.Value = 70
            $statusLabel.Text = "Restaurando dados..."
            $logLabel.Text = "Restaurando clientes, usuários, fotos e manuais..."
            $installerForm.Refresh()
            Start-Sleep -Milliseconds 500

            foreach ($folderName in @('data', 'manuais')) {
                $savedFolder = Join-Path $script:BackupRoot $folderName
                if (Test-Path -LiteralPath $savedFolder) {
                    Copy-FolderSafely $savedFolder (Join-Path $target $folderName)
                    Write-Log "Restauração de $folderName concluída"
                }
            }
        }
    }

    $progressBar.Value = 80
    $statusLabel.Text = "Verificando instalação..."
    $logLabel.Text = "Validando arquivos..."
    $installerForm.Refresh()
    Start-Sleep -Milliseconds 500

    $startFile = Join-Path $target 'abrir_seg_vendas.bat'
    $networkConfigFile = Join-Path $target 'scripts\CONFIGURAR_REDE_BETA.bat'
    if (-not (Test-Path -LiteralPath $startFile)) {
        throw 'O arquivo abrir_seg_vendas.bat não foi encontrado após a instalação.'
    }
    if (-not (Test-Path -LiteralPath $networkConfigFile)) {
        throw 'O arquivo CONFIGURAR_REDE_BETA.bat não foi encontrado após a instalação.'
    }
    Write-Log "Arquivos validados com sucesso"

    if (-not $NoShortcuts) {
        $progressBar.Value = 90
        $statusLabel.Text = "Criando atalhos..."
        $logLabel.Text = "Adicionando ao Menu Iniciar e Desktop..."
        $installerForm.Refresh()
        Start-Sleep -Milliseconds 500

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
            $shortcut.Description = 'Abrir SEG Vendas 5.9.14'
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
            $shortcut.Description = 'Configurar IP, porta e endereço público do SEG Vendas'
            $shortcut.IconLocation = "$env:SystemRoot\System32\SHELL32.dll,18"
            $shortcut.Save()
        }
        Write-Log "Atalhos criados com sucesso"
    }

    $progressBar.Value = 100
    $statusLabel.Text = "Instalação concluída!"
    $logLabel.Text = "SEG Vendas 5.9.14 instalado em: $target"
    $installerForm.Refresh()
    Start-Sleep -Milliseconds 1500

    Write-Log "Instalação concluída com sucesso"

    if (-not $NoLaunch) {
        Write-Log "Abrindo SEG Vendas..."
        Start-Process -FilePath $startFile -WorkingDirectory $target
    }

    $installerForm.Close()
}
catch {
    $progressBar.Value = 0
    $statusLabel.Text = "Erro na instalação"
    $statusLabel.ForeColor = [System.Drawing.Color]::Red
    $logLabel.Text = $_.Exception.Message
    $installerForm.Refresh()
    Write-Log "ERRO: $($_.Exception.Message)"
    Start-Sleep -Milliseconds 3000
    $installerForm.Close()
    exit 1
}
