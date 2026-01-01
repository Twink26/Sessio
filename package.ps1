# Session Recap Extension Packaging Script for Windows
# PowerShell script to package the extension as VSIX

param(
    [string]$Action = "package"
)

$ErrorActionPreference = "Stop"

function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if npm is available
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm is not installed or not in PATH"
    exit 1
}

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Error "package.json not found. Are you in the project root?"
    exit 1
}

switch ($Action.ToLower()) {
    "package" {
        Write-Status "Packaging extension as VSIX..."
        
        # Check if vsce is installed
        if (-not (Get-Command vsce -ErrorAction SilentlyContinue)) {
            Write-Warning "vsce is not installed globally"
            Write-Status "Installing vsce globally..."
            npm install -g @vscode/vsce
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to install vsce"
                exit 1
            }
        }
        
        # Install dependencies if needed
        if (-not (Test-Path "node_modules")) {
            Write-Status "Installing dependencies..."
            npm install
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to install dependencies"
                exit 1
            }
        }
        
        # Compile TypeScript
        Write-Status "Compiling TypeScript..."
        npm run compile
        if ($LASTEXITCODE -ne 0) {
            Write-Error "TypeScript compilation failed"
            exit 1
        }
        
        # Package extension
        Write-Status "Creating VSIX package..."
        vsce package
        if ($LASTEXITCODE -ne 0) {
            Write-Error "VSIX packaging failed"
            exit 1
        }
        
        # Find the created VSIX file
        $vsixFiles = Get-ChildItem -Filter "*.vsix" | Sort-Object LastWriteTime -Descending
        if ($vsixFiles) {
            $latestVsix = $vsixFiles[0]
            Write-Success "VSIX package created: $($latestVsix.Name)"
            Write-Success "File size: $([math]::Round($latestVsix.Length / 1KB, 2)) KB"
            Write-Status "You can now install it using: Extensions: Install from VSIX... in VS Code"
        } else {
            Write-Warning "VSIX file not found, but vsce may have completed"
        }
    }
    
    "install-vsce" {
        Write-Status "Installing vsce globally..."
        npm install -g @vscode/vsce
        if ($LASTEXITCODE -eq 0) {
            Write-Success "vsce installed successfully"
        } else {
            Write-Error "Failed to install vsce"
            exit 1
        }
    }
    
    "check" {
        Write-Status "Checking prerequisites..."
        
        $allGood = $true
        
        # Check npm
        if (Get-Command npm -ErrorAction SilentlyContinue) {
            Write-Success "npm is installed"
        } else {
            Write-Error "npm is not installed"
            $allGood = $false
        }
        
        # Check vsce
        if (Get-Command vsce -ErrorAction SilentlyContinue) {
            Write-Success "vsce is installed"
        } else {
            Write-Warning "vsce is not installed. Run: .\package.ps1 install-vsce"
            $allGood = $false
        }
        
        # Check node_modules
        if (Test-Path "node_modules") {
            Write-Success "Dependencies are installed"
        } else {
            Write-Warning "Dependencies not installed. Run: npm install"
            $allGood = $false
        }
        
        # Check compiled output
        if (Test-Path "out\extension.js") {
            Write-Success "TypeScript is compiled"
        } else {
            Write-Warning "TypeScript not compiled. Run: npm run compile"
            $allGood = $false
        }
        
        if ($allGood) {
            Write-Success "All checks passed! Ready to package."
        } else {
            Write-Warning "Some checks failed. Please fix the issues above."
        }
    }
    
    default {
        Write-Host "Session Recap Extension Packaging Script"
        Write-Host ""
        Write-Host "Usage: .\package.ps1 [action]"
        Write-Host ""
        Write-Host "Actions:"
        Write-Host "  package      Package extension as VSIX (default)"
        Write-Host "  install-vsce Install vsce globally"
        Write-Host "  check        Check prerequisites"
        Write-Host ""
        Write-Host "Examples:"
        Write-Host "  .\package.ps1           # Package extension"
        Write-Host "  .\package.ps1 package   # Same as above"
        Write-Host "  .\package.ps1 check     # Check prerequisites"
    }
}

