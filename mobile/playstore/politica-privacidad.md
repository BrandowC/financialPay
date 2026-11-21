# Política de Privacidad — AM Cuenta

**Última actualización: 4 de septiembre de 2026**

Esta Política de Privacidad describe cómo **AM Cuenta** ("la Aplicación", "nosotros") recolecta, usa y protege la información de los usuarios cuando utilizan nuestra aplicación móvil.

## 1. Naturaleza de la aplicación

**AM Cuenta es una aplicación de gestión de cuenta y consulta de saldo interno.** El valor que se muestra en la pantalla de cuenta es un dato administrativo que el equipo de AM Cuenta gestiona manualmente para cada usuario; **no representa fondos bancarios, no puede transferirse, retirarse, cambiarse por dinero ni usarse como medio de pago.**

**AM Cuenta NO es un banco, NO es una entidad financiera, NO otorga créditos ni préstamos, NO procesa pagos ni transacciones de ningún tipo, y NO está afiliada a ninguna institución bancaria real.** El número de cuenta que se muestra (formato `AMC-XXXXXXXX`) es un identificador interno de la aplicación, no un número de cuenta bancaria ni de tarjeta.

## 2. Información que recolectamos

Cuando un usuario se registra en la aplicación, recolectamos los siguientes datos:

- **Nombre completo:** para identificar al usuario dentro de la aplicación.
- **Correo electrónico:** como identificador de cuenta y para autenticación.
- **Contraseña:** nunca se almacena en texto plano; se guarda con un algoritmo de hashing con clave (Argon2id), el mismo tipo de protección recomendado por estándares internacionales de seguridad (OWASP).
- **Fecha de nacimiento:** para verificar que el usuario es mayor de 18 años.
- **Número de teléfono celular (Estados Unidos):** para identificación de contacto.

No recolectamos información de ubicación, contactos, fotos, micrófono, cámara, ni ningún otro dato del dispositivo. No usamos identificadores de publicidad ni SDKs de rastreo de terceros.

## 3. Cómo usamos la información

Los datos se utilizan únicamente para:

- Crear y administrar la cuenta del usuario dentro de la aplicación.
- Autenticar al usuario al iniciar sesión.
- Mostrar el perfil y el valor de cuenta dentro de la app.
- Mantener un registro administrativo interno del negocio (nombre, contacto y valor de cuenta), al que solo el personal autorizado de AM Cuenta tiene acceso mediante un panel de administración protegido con usuario y contraseña.

**No vendemos, alquilamos ni compartimos los datos con terceros con fines de publicidad o marketing.** No mostramos anuncios de ningún tipo dentro de la aplicación.

## 4. Almacenamiento y seguridad

Los datos se almacenan en una base de datos PostgreSQL operada por AM Cuenta, alojada en infraestructura en la nube.

- Toda la comunicación entre la aplicación y los servidores está cifrada en tránsito mediante HTTPS/TLS.
- Las contraseñas se almacenan utilizando Argon2id, un algoritmo de hashing con clave diseñado específicamente para resistir ataques de fuerza bruta.
- Cada sesión usa tokens de acceso de corta duración que se renuevan automáticamente; el dispositivo nunca guarda la contraseña, solo una credencial cifrada por el sistema operativo (Keychain en iOS, Keystore en Android).
- Todo cambio al valor de cuenta de un usuario queda registrado de forma permanente e inmutable (quién lo hizo, cuándo y desde dónde), como medida de control interno y trazabilidad.

## 5. Servicios de terceros

La aplicación utiliza los siguientes servicios de terceros, únicamente como proveedores de infraestructura para operar la aplicación (nunca para publicidad):

- **Expo (Expo Application Services)** — plataforma de compilación y distribución de la aplicación. Política de privacidad: https://expo.dev/privacy
- **Proveedor de infraestructura en la nube** donde se aloja la base de datos y el servidor de la aplicación.
- **Google Sheets (opcional, uso interno)** — el equipo administrativo de AM Cuenta puede mantener una copia de los registros de clientes (nombre, contacto, valor de cuenta) en una hoja de cálculo privada de Google, con el único fin de llevar un respaldo administrativo del negocio. Esta hoja no es pública y no se comparte con nadie fuera del equipo de AM Cuenta. Política de privacidad de Google: https://policies.google.com/privacy

Ninguno de estos proveedores utiliza los datos de los usuarios para sus propios fines de publicidad.

## 6. Derechos del usuario

El usuario tiene derecho a:

- **Acceder** a sus datos personales en cualquier momento desde la pantalla "Mi Cuenta" en la aplicación.
- **Solicitar la eliminación** de su cuenta y todos sus datos asociados directamente desde la aplicación, usando el botón **"Eliminar mi cuenta"** en la pantalla de cuenta. La eliminación es **inmediata y permanente** y borra también el registro en la hoja de cálculo interna mencionada en la Sección 5.
- Alternativamente, el usuario puede solicitar la eliminación contactándonos por correo electrónico (ver Sección 8).

Una vez eliminada la cuenta, los datos no se pueden recuperar.

## 7. Menores de edad

La aplicación **requiere que el usuario tenga 18 años o más** para poder registrarse; la fecha de nacimiento se verifica en el momento del registro y las cuentas de menores de 18 años son rechazadas automáticamente. No recolectamos intencionalmente información de menores de edad. Si descubrimos que un menor ha logrado registrarse, eliminaremos su cuenta y datos de inmediato.

## 8. Contacto

Para cualquier pregunta sobre esta política, solicitudes de eliminación de cuenta, o ejercicio de derechos sobre los datos, puedes contactarnos al siguiente correo electrónico:

**fronterayaite@gmail.com**

## 9. Cambios a esta política

Esta política puede actualizarse ocasionalmente. La fecha de "última actualización" en la parte superior indica la versión vigente. Los cambios significativos serán notificados dentro de la aplicación.

## 10. Jurisdicción

Esta política se rige por las leyes aplicables al lugar donde se publique y distribuya la aplicación.
