#!/bin/bash

# Test brief for Neuronix
BRIEF="Создай простое веб-приложение на React для отображения списка задач (Todo List). Должны быть функции: добавить задачу, отметить выполненную, удалить. Используй TypeScript и Tailwind CSS."

echo "Testing Neuronix with brief:"
echo "$BRIEF"
echo ""
echo "Sending request to local server..."
echo ""

curl -X POST http://localhost:3003/api/create \
  -H "Content-Type: application/json" \
  -d "{\"brief\": \"$BRIEF\"}" \
  --no-buffer

echo ""
echo ""
echo "Test completed!"
