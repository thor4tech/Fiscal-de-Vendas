# Estrutura do Banco de Dados (Firestore)

O banco de dados foi reestruturado para utilizar **Sub-coleções**. Isso garante que os dados de cada usuário fiquem isolados.

## 1. Coleção: `users`
Armazena os perfis dos usuários.
*   **Caminho:** `/users/{userId}`
*   **Campos:**
    *   `uid`: string
    *   `email`: string
    *   `plan`: "free" | "pro"
    *   `credits`: number
    *   `createdAt`: timestamp

## 2. Sub-coleção: `audits`
Armazena as análises DE UM usuário específico.
*   **Caminho:** `/users/{userId}/audits/{auditId}`
*   **Campos:**
    *   `fileName`: string
    *   `fileType`: string
    *   `score`: number
    *   `verdict`: string
    *   `result`: JSON object (retorno da IA)
    *   `timestamp`: timestamp

---

## Por que essa mudança?
1.  **Segurança:** É impossível "acidentalmente" consultar a auditoria de outro usuário, pois você precisa saber o ID dele para acessar a rota.
2.  **Performance:** As queries ficam mais rápidas pois o Firestore não precisa filtrar uma lista gigante de todas as auditorias do mundo; ele busca apenas na pequena lista daquele usuário.
3.  **Simplicidade:** Remove a necessidade de criar índices compostos complexos no Firebase Console.
