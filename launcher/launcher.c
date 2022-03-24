#include <stdlib.h>
#include <stdio.h>
#include <libgen.h>         // dirname
#include <unistd.h>         // readlink
#include <linux/limits.h>   // PATH_MAX


int main(int argc, char** argv) {
    char result[PATH_MAX];
    ssize_t count = readlink("/proc/self/exe", result, PATH_MAX);
    const char *path;
    if (count != -1) {
        path = dirname(result);
    }
    printf("%s", path);
    chdir(path);
    system("./exogui --no-sandbox");
    return 0;
}
