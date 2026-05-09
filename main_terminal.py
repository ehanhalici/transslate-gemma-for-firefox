from dataclasses import dataclass

from common_huggingface import Translator


@dataclass
class Color:
    normal = '\033[0m'
    black  = '\033[30m' + "%s" + normal
    red    = '\033[31m' + "%s" + normal
    green  = '\033[32m' + "%s" + normal
    yellow = '\033[33m' + "%s" + normal
    blue   = '\033[34m' + "%s" + normal
    purple = '\033[35m' + "%s" + normal
    cyan   = '\033[36m' + "%s" + normal
    bold   = '\033[1m'  + "%s" + normal
    uline  = '\033[4m'  + "%s" + normal
    blink  = '\033[5m'  + "%s" + normal
    invert = '\033[7m'  + "%s" + normal

translator = Translator()

while True:
    user_input = input(Color.blue % "> ")
    if user_input == "":
        continue
    if user_input == "\\by":
        break

    translation, diff_time = translator.process(user_input)
    print("\n" + (Color.red % (Color.uline % diff_time) + "\n"))
    print("\n" + (Color.green % translation) + "\n")
