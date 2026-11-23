# AhaTutor - Pizarra Interactiva con Profesores IA 🎓✏️

Una aplicación web de tutoría interactiva inspirada en **Ahaboard**, diseñada para explicar cualquier concepto o problema académico dibujando paso a paso sobre una pizarra animada sincronizada con voz en tiempo real y método socrático.

---

## 🌟 Características Principales

1. **4 Profesores con Personalidad y Voz Única:**
   - **Don Tomás (Física y Matemáticas):** Enfoque analítico riguroso, tiza clásica, despiece de ecuaciones y alerta de trampas comunes.
   - **Profe Clara (Biología y Ciencias):** Esquemas biológicos limpios, colores vivos y conexiones de sistemas.
   - **Nova IA (Programación y Lógica):** Descomposición algorítmica y retos de pensamiento deductivo.
   - **Dra. Valeria (Química):** Estequiometría, cinéticas y balances moleculares.

2. **Motor de Pizarra Dinámica Dual:**
   - **Pizarra Clásica de Tiza (Verde):** Textura de pizarra real, polvo de tiza y trazos manuscritos.
   - **Pizarra Blanca Moderna (Dry-Erase):** Trazo de rotulador nítido y moderno.
   - **Renderizado Matemático:** Fórmulas nítidas con KaTeX superpuesto en coordenadas exactas.
   - **Diagramas y Gráficas Vectoriales:** Trazado de parábolas, secantes, tangentes, vectores de proyectiles y cloroplastos.
   - **Puntero/Mano Animada:** Indicador visual que sigue las coordenadas de escritura del profesor en directo.

3. **Sincronización Voz y Pizarra (Speech-to-Draw):**
   - Utiliza la **Web Speech API** nativa (gratuita, sin latencia de red y con voces en español personalizables por tono y velocidad).
   - El profesor habla mientras escribe y dibuja los conceptos.

4. **Método Socrático (Pausa de Pensamiento):**
   - El profesor no hace monólogos infinitos: en pasos clave se detiene y pregunta al estudiante para verificar su razonamiento antes de avanzar.
   - Pistas progresivas y retroalimentación didáctica sin castigo.

5. **Consolidación Post-Lección:**
   - **Tarjetas Flashcards:** Repaso activo volteable con un clic.
   - **Quiz Rápido:** Preguntas tipo test con explicación de errores y celebración con confeti al finalizar.
   - **Exportación:** Botón para descargar la pizarra completa en formato imagen PNG.

---

## 🚀 Inicio Rápido

### Requisitos
- Node.js 18+ (recomendado 20 o 22)
- npm o pnpm

### Instalación y Ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev

# 3. Compilar para producción
npm run build
```

---

## 🏗️ Arquitectura Técnica

```
src/
├── types.ts                   # Protocolo DSL de comandos de pizarra y pasos
├── data/
│   ├── teachers.ts            # Definición de profesores, avatares y voces
│   └── presetLessons.ts       # Lecciones de prueba ricas (Física, Álgebra, Biología)
├── services/
│   ├── speechService.ts       # Síntesis de voz Web Speech API con eventos
│   └── aiGenerator.ts         # Generador pedagógico de lecciones a partir de cualquier pregunta
├── components/
│   ├── Whiteboard.tsx         # Canvas interactivo + KaTeX + animador de trazos
│   ├── TeacherAvatar.tsx      # Avatar SVG reactivo con boca parlante
│   ├── ControlBar.tsx         # Barra de navegación, velocidad y cambio de pizarra
│   ├── TeacherPicker.tsx      # Selector de profesores
│   ├── SocraticModal.tsx      # Pausa interactiva socrática
│   ├── PostLessonReview.tsx   # Flashcards y Quiz interactivo
│   └── AskModal.tsx           # Formulario para preguntas libres / ayuda con tareas
├── App.tsx                    # Orquestador principal de estado y timeline
└── index.css                  # Estilos Tailwind CSS v4 y animaciones
```
