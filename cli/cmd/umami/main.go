package main

import (
	"context"
	"os"

	"github.com/xingkaixin/umami/cli/internal/cli"
)

var version = "dev"

func main() {
	os.Exit(cli.Run(context.Background(), os.Args[1:], os.Stdin, os.Stdout, os.Stderr, version))
}
