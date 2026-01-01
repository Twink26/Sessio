#!/bin/bash

# Session Recap Extension Testing Script
# Quick testing commands for different scenarios

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    echo "Session Recap Extension Testing Script"
    echo ""
    echo "Usage: ./test.sh [option]"
    echo ""
    echo "Options:"
    echo "  unit          Run unit tests only"
    echo "  integration   Run integration tests only"
    echo "  all           Run all tests"
    echo "  coverage      Run tests with coverage report"
    echo "  watch         Run tests in watch mode"
    echo "  dev           Start development testing (compile + watch + VS Code)"
    echo "  manual        Launch VS Code Extension Development Host"
    echo "  lint          Run linter"
    echo "  compile       Compile TypeScript"
    echo "  clean         Clean build artifacts and reinstall"
    echo "  help          Show this help message"
    echo ""
}

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed or not in PATH"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Are you in the project root?"
    exit 1
fi

case "${1:-help}" in
    "unit")
        print_status "Running unit tests..."
        npm run test:unit
        print_success "Unit tests completed"
        ;;
    
    "integration")
        print_status "Running integration tests..."
        npm run test:integration
        print_success "Integration tests completed"
        ;;
    
    "all")
        print_status "Running all tests..."
        npm run test:all
        print_success "All tests completed"
        ;;
    
    "coverage")
        print_status "Running tests with coverage..."
        npm run test:coverage
        print_success "Coverage report generated in coverage/ directory"
        ;;
    
    "watch")
        print_status "Starting tests in watch mode..."
        print_warning "Press Ctrl+C to stop watching"
        npm run test:watch
        ;;
    
    "dev")
        print_status "Starting development testing environment..."
        
        # Install dependencies if needed
        if [ ! -d "node_modules" ]; then
            print_status "Installing dependencies..."
            npm install
        fi
        
        # Compile TypeScript
        print_status "Compiling TypeScript..."
        npm run compile
        
        # Start watch mode in background
        print_status "Starting TypeScript compiler in watch mode..."
        npm run watch &
        WATCH_PID=$!
        
        # Start test watch mode in background
        print_status "Starting test watch mode..."
        npm run test:watch &
        TEST_PID=$!
        
        print_success "Development environment started!"
        print_status "TypeScript compiler watching for changes..."
        print_status "Tests running in watch mode..."
        print_warning "Press F5 in VS Code to launch Extension Development Host"
        print_warning "Press Ctrl+C to stop all processes"
        
        # Wait for user interrupt
        trap "kill $WATCH_PID $TEST_PID 2>/dev/null; exit" INT
        wait
        ;;
    
    "manual")
        print_status "Preparing for manual testing..."
        
        # Ensure dependencies are installed
        if [ ! -d "node_modules" ]; then
            print_status "Installing dependencies..."
            npm install
        fi
        
        # Compile TypeScript
        print_status "Compiling TypeScript..."
        npm run compile
        
        # Launch VS Code Extension Development Host
        print_status "Launching VS Code Extension Development Host..."
        if command -v code &> /dev/null; then
            code --extensionDevelopmentPath=.
            print_success "Extension Development Host launched"
            print_status "The extension should now be active in the new VS Code window"
        else
            print_warning "VS Code 'code' command not found in PATH"
            print_status "Please:"
            print_status "1. Open VS Code"
            print_status "2. Press F5 or go to Run > Start Debugging"
            print_status "3. This will open Extension Development Host with your extension loaded"
        fi
        ;;
    
    "lint")
        print_status "Running linter..."
        npm run lint
        print_success "Linting completed"
        ;;
    
    "compile")
        print_status "Compiling TypeScript..."
        npm run compile
        print_success "Compilation completed"
        ;;
    
    "clean")
        print_status "Cleaning build artifacts..."
        rm -rf out/
        rm -rf node_modules/
        rm -rf coverage/
        rm -f package-lock.json
        
        print_status "Reinstalling dependencies..."
        npm install
        
        print_status "Recompiling..."
        npm run compile
        
        print_success "Clean and rebuild completed"
        ;;
    
    "help"|*)
        show_help
        ;;
esac