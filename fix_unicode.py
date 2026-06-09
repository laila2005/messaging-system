import os

def fix_unicode(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.py'):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    if '[OK]' in content or '[ERROR]' in content or '[SECURE]' in content or '\u2713' in content or '\u2717' in content:
                        content = content.replace('[OK]', '[OK]').replace('[ERROR]', '[ERROR]').replace('[SECURE]', '[SECURE]')
                        content = content.replace('\u2713', '[OK]').replace('\u2717', '[ERROR]')
                        
                        with open(path, 'w', encoding='utf-8') as f:
                            f.write(content)
                        print(f"Fixed {path}")
                except Exception as e:
                    print(f"Failed {path}: {e}")

if __name__ == '__main__':
    fix_unicode('.')
