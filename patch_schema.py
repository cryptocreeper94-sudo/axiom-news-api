import re

with open('prisma/schema.prisma', 'r', encoding='utf-8') as f:
    content = f.read()

# Add category and image to Article
if "category        String?" not in content:
    content = content.replace(
        "isSatire        Boolean  @default(false)",
        "isSatire        Boolean  @default(false)\n  category        String?  @default(\"World\")\n  image           String?"
    )

with open('prisma/schema.prisma', 'w', encoding='utf-8') as f:
    f.write(content)

print("Prisma schema patched!")
