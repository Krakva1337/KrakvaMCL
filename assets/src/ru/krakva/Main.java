package ru.krakva;

import java.lang.instrument.ClassFileTransformer;
import java.lang.instrument.Instrumentation;
import java.security.ProtectionDomain;

public class Main {
    public static void premain(String agentArgs, Instrumentation inst) {
        System.out.println("[Patcher] processing");
        inst.addTransformer(new ClassFileTransformer(){

            @Override
            public byte[] transform(ClassLoader loader, String className, Class<?> classBeingRedefined, ProtectionDomain protectionDomain, byte[] classfileBuffer) {
                if (className != null) {
                    // Заменяем точки на слэши, так как JVM передает внутренние имена через слэши
                    String normalizedName = className.replace('.', '/');
                    
                    // Используем contains вместо endsWith для большей гибкости
                    if (normalizedName.contains("TitleScreen") || normalizedName.contains("GuiMainMenu")) {
                        System.out.println("[Patcher] Found: " + normalizedName);
                        // Здесь должна быть логика патчинга байтов
                    }
                }
                return classfileBuffer;
            }
        });
    }
}

