import urllib.request
import os

os.makedirs('src/main/resources/fonts', exist_ok=True)
urllib.request.urlretrieve('https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Regular.ttf', 'src/main/resources/fonts/Roboto-Regular.ttf')
print('Downloaded successfully!')
