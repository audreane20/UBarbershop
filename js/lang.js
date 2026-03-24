// lang.js — EN/FR toggle + translations + helpers (Admin + Calendar + Home ready)

const translations = {
    en: {
        nav: {
            home: "Home",
            about: "About",
            contact: "Contact",
            exitAdmin: "Exit Admin Mode",
            addEmployee: "Add Employee",
            calendar: "Appointments Calendar",
            unavailable: "Unavailable Days",
            services: "Services",
            adminMode: "Admin Mode",
            appointBtn: "Make an Appointment",
        },

        errors: {
            adminOnly: "Admin only. Please log in with the admin account.",
            permission: "Missing or insufficient permissions (Firestore rules).",
        },

        auth: {
            // Header / links
            loginLink: "Login",
            profileLinkTitle: "Go to your profile",

            // Common fields
            name: { label: "Name", placeholder: "Your name" },
            email: { label: "Email", placeholder: "Email" },
            password: { label: "Password", placeholder: "Password" },

            login: {
                title: "Login",
                button: "Login",
                forgot: "Forgot password?",
                noAccount: "Don't have an account?",
                registerLink: "Register",
            },

            oauth: {
                google: "Continue with Google",
                facebook: "Continue with Facebook",
            },

            errors: {
                accountExistsDifferentCredential: "An account already exists with this email using another sign-in method. Please sign in with the original method to link your accounts.",
            },


            register: {
                title: "Register",
                button: "Register",
                confirmLabel: "Confirm Password",
                confirmPlaceholder: "Confirm Password",
                haveAccount: "Already have an account?",
                goLogin: "Go to Login",
            },

            profile: {
                title: "My Profile",
                save: "Save Changes",
                logout: "Logout",
                msgNotLoggedIn: "You are not logged in.",
                msgUpdated: "Profile updated.",
                msgUpdateFail: "Could not update profile. Please try again.",
                msgLogoutFail: "Logout failed. Please try again.",
            },

            errors: {
                userNotFound: "No account exists with this email. Please register first.",
                invalidCredential: "Incorrect email or password.",
                invalidEmail: "Please enter a valid email address.",
                missingPassword: "Please enter your password.",
                tooManyRequests: "Too many attempts. Please try again later.",
                loginFailed: "Login failed. Please try again.",
                enterEmailFirst: "Enter your email first, then click “Forgot password?”.",
                resetSent: "Password reset email sent. Check your inbox.",
                resetGeneric: "If an account exists for that email, you’ll receive a reset message shortly.",
                nameRequired: "Please enter your name.",
                passwordsNoMatch: "Passwords do not match.",
                registerFailed: "Registration failed. Please try again.",

            },
        },

        // ✅ ONE source of truth for service names (use: t("services."+id))
        services: {
            haircut: "Hair cut",
            kids: "Kids hair cut",
            beard: "Beard cut",
            hair_beard: "Hair cut & Beard cut",
        },

        home: {
            hero: {
                pill: "Fresh cuts • Clean fades • Beard grooming",
                title: "Look sharp. Feel confident.",
                sub: "Book your appointment in seconds — professional barbers, clean shop, great results.",
                book: "Book an Appointment",
                gallery: "View Gallery",
            },
            addons: {
                online: { title: "Online Booking", desc: "Fast scheduling + reminders." },
                snacks: { title: "Free Snacks", desc: "Relax while you wait." },
                products: { title: "Premium Products", desc: "Hair & beard care available." },
            },
            services: {
                title: "Services",
                subtitle: "Pick your service — we’ll handle the rest.",
                haircut: { title: "Haircut", desc: "Clean cut, sharp finish." },
                fade: { title: "Haircut + Beard Trim", desc: "Double your style." },
                beard: { title: "Beard Groom", desc: "Trim + lineup for a clean look." },
                kids: { title: "Kids Cut", desc: "Quick, friendly, and fresh." },
            },
            vibe: {
                clean: { title: "Comfortable & clean", desc: "Modern setup with a great vibe." },
                detail: { title: "Detail-focused", desc: "Edges, blends, and lines done right." },
                precision: { title: "Precision every time", desc: "Consistency you can trust." },
            },
            gallery: {
                title: "Gallery",
                subtitle: "Recent cuts & shop atmosphere.",
                cta: "Book Your Spot",
            },
        },

        appoint: {
            submit: "Schedule an Appointment",

            title: "Schedule an Appointment",
            subtitle: "Choose a service and time. We’ll confirm your appointment.",

            serviceLabel: "Service",
            servicePlaceholder: "Select a service",

            dresserLabel: "Hairdresser",
            dresserHint: "\"Any available\" selects all hairdressers.",

            dateLabel: "Date",
            timeLabel: "Time",
            timePlaceholder: "Select a time",

            nameLabel: "Full Name",
            namePlaceholder: "Your name",
            phoneLabel: "Phone (optional)",
            phonePlaceholder: "(450) 000-0000",
            emailLabel: "Email",
            emailPlaceholder: "you@example.com",
            notesLabel: "Notes (optional)",
            notesPlaceholder: "Anything we should know?",

            confirmBtn: "Confirm Appointment",
            upcomingTitle: "Your upcoming appointments",
            pastBtn: "Past appointments",
            pastTitle: "Past appointments",
            noUpcoming: "No upcoming appointments.",
            noPast: "No past appointments.",
            loginToManage: "Log in to see and cancel your appointments.",
            authLoggedInAs: "Logged in as: {email}",
            authLoggedOut: "Log in to see and cancel your appointments.",
            loginRequiredTitle: "Login required",
            loginRequiredMsg: "Please log in to book an appointment.",
            loginRequiredLogin: "Login",
            loginRequiredRegister: "Register",
            loginRequiredBack: "Back to Home",

            any: "Any available",
            noStylists: "No stylists configured yet. Please add them in Admin mode.",
            noStylistsTitle: "No stylists available",

            selectServiceDays: "Select a service to see available days",
            pickDayTimes: "Pick a day to see times.",
            dayBlocked: "This day is not available.",
            noTimes: "No times available for that day.",
            times30: "Times are shown in 30-minute intervals.",

            fillRequired: "Please fill in all required fields.",
            invalidEmail: "Please enter a valid email address.",
            pickStylist: "Please select a preferred stylist (or choose Any available).",
            noPreferredAtTime: "No preferred stylists are available at that time.",
            overlap: "That time overlaps with an existing appointment for the selected hairdresser.",
            saved: "Appointment saved! We’ll contact you to confirm.",

            hairdresserPrefix: "Hairdresser:",
            removeBtn: "Cancel Appointment",

            hoursTitle: "Availability",
            hoursClosed: "Closed",
            hoursNotSet: "Hours not set",

            dayMon: "Monday",
            dayTue: "Tuesday",
            dayWed: "Wednesday",
            dayThu: "Thursday",
            dayFri: "Friday",
            daySat: "Saturday",
            daySun: "Sunday",

            cal: {
                client: "Client",
                service: "Service",
                barber: "Barber",
                notes: "Notes",
                phone: "Phone",
                date: "Date",
                time: "Time",

            },

            email: {
                thankYou: "Thank You for Choosing UBarbershop!",
                confirmed: "Your booking at UBarbershop has been confirmed.",
                with: "with",
                clientNotes: "Client notes:",
                addToCalendar: "Add to calendar:",
                btnGoogle: "Google Calendar",
                btnOutlook: "Outlook Calendar",
                btnIphone: "iPhone Calendar",
                tip: "Tip: some email apps will also add it automatically when they detect a date/time.",
                cancelText: "If you need to cancel your appointment,",
                clickHere: "click here",
                reschedule: "If you need to cancel or reschedule, please contact the shop directly.",
                thanks: "Thanks,",
                phoneLabel: "Phone (optional)",
                shopPhoneLabel: "Phone",
                subject: "Appointment Confirmed — UBarbershop",
                preview: "Your booking at UBarbershop has been confirmed.",
                reminderTitle: "Appointment Reminder",
                reminderIntro: "You have an appointment tomorrow at UBarbershop.",
                reminderSubject: "Reminder: your appointment tomorrow",
                reminderPreview: "You have an appointment tomorrow at UBarbershop.",
                cancelledSubject: "Appointment cancelled — UBarbershop",
                cancelledTitle: "Appointment Cancelled at UBarbershop",
                cancelledClientIntro: "Your appointment has been cancelled.",
                cancelledSalonIntro: "Your appointment has been cancelled by the salon.",
                cancelledByClientLabel: "Cancelled by customer",
                cancelledBySalonLabel: "Cancelled by salon",
                cancelledPreview: "Your appointment at UBarbershop has been cancelled.",
            },
        },

        footer: {

            categories: "Categories",
            contact: "Contact",
            phone: "Phone",
            phoneLabel: "Phone:",
            newsletter: "Newsletter",
            follow: "Follow Us",
        },

        contact: {
            title: "Contact Us",
            helpTitle: "We're Here to Help",
            phoneLabel: "Phone:",
            addressLabel: "Address:",
            messageTitle: "Send Us a Message",
            emailLabel: "Your Email",
            emailPlaceholder: "you@example.com",
            messageLabel: "Your Message",
            messagePlaceholder: "Write your message here...",
            submit: "Submit",
        },

        about: {
            title: "About This Business",
            subtitle: "A Young Woman’s First Business Journey",
            p1:
                "UBarbershop was created as the first business venture of a young woman " +
                "driven by passion, determination, and a desire to build something meaningful. " +
                "Opening this barbershop represents an important milestone and the beginning " +
                "of an exciting entrepreneurial journey.",
            p2:
                "The goal of UBarbershop is to provide a welcoming, professional space where " +
                "clients feel confident, comfortable, and valued. Every detail — from the " +
                "atmosphere to the services offered — has been carefully considered to deliver " +
                "quality and consistency, including the complimentary refreshments offered to all " +
                "clients during their visit.",
            p3:
                "This business is more than just a barbershop; it is a reflection of hard work, " +
                "perseverance, and the courage it takes to turn a vision into reality. It stands " +
                "as proof that with dedication and ambition, a first business can become something " +
                "truly special.",
            thanks: "Thank you for supporting a local business and being part of this journey!",
        },

        admin: {
            title: "Admin – Employees",
            subtitle: "Add hairdressers and set their working days + hours.",
            name: "Name",
            namePlaceholder: "e.g. Sofia",
            workSchedule: "Work schedule",
            addEmployee: "Add employee",
            currentEmployees: "Current employees",
            save: "Save",
            remove: "Remove",

            added: "Employee added.",
            updated: "Employee updated.",
            deleted: "Employee removed.",
            required: "Please enter a name.",
            saved: "Saved.",

            edit: "Edit",
            editTitle: "Edit stylist",
            cancel: "Cancel",
            saveChanges: "Save changes",
            off: "Off",
            none: "No stylists yet.",
        },

        calendar: {
            pageTitle: "Admin – Appointments",
            searchPlaceholder: "Search name / phone / service…",
            allHairdressers: "All hairdressers",
            clearAll: "Clear ALL saved appointments",
            removed: "Appointment removed.",
            cleared: "All saved appointments cleared.",
            noAppointments: "No appointments",
            count: "{n} appointment(s)",
            noAppointmentsDay: "No appointments for this day.",
            hairdresser: "Hairdresser:",
            fullName: "Full name", // ✅ added
            remove: "Cancel Appointment",
            monthAriaPrev: "Previous month",
            monthAriaNext: "Next month",
        },

        confirm: {
            deleteAppointment: "Are you sure?",
            confirmAction: "Yes, cancel appointment",
            keepAction: "Keep appointment",
            deleteEmployee: "Are you sure you want to delete this employee?",
            deleteBlockedDay: "Remove this blocked day?",
            deleteService: "Delete this service?"
        },

        unavailable: {
            title: "Unavailable Days",
            subtitle: "Block days off (vacation, closed shop, etc.). Blocked days will not appear as available for booking.",
            tip: "Tip: choose the same start/end date to block only one day.",
            startDate: "Start date",
            endDate: "End date",
            employee: "Hairdresser",
            all: "All hairdressers (shop closed)",
            allShort: "All",
            reason: "Reason (optional)",
            reasonPlaceholder: "Vacation / Closed",
            add: "Add",
            listTitle: "Upcoming blocked days",
            none: "No blocked days yet.",
            for: "For",
            remove: "Remove",
            saved: "Saved.",
            savedRange: "Saved {n} day(s).",
            deleted: "Removed.",
            loadError: "Could not load blocked days.",
            saveError: "Could not save.",
            deleteError: "Could not remove.",
            pickDate: "Please pick a date.",
            pickRange: "Please pick a start and end date.",
            rangeInvalid: "End date must be on or after start date.",
            tooMany: "Please select a shorter range (max {n} days).",
            confirmRange: "Block {n} day(s)?",
            preview: "Blocking {n} day(s): {start} → {end}",
        },

        servicesAdmin: {
            title: "Services",
            subtitle: "Add, edit, or delete services. These services will appear on the booking page.",
            id: "Service ID",
            idPlaceholder: "haircut",
            nameEn: "Name (EN)",
            nameFr: "Name (FR)",
            duration: "Duration (minutes)",
            price: "Price ($)",
            order: "Sort order",
            active: "Active",
            add: "Save service",
            clear: "Clear",
            listTitle: "Current services",
            none: "No services yet.",
            edit: "Edit",
            delete: "Delete",
            activePill: "Active",
            inactivePill: "Inactive",
            saved: "Saved.",
            deleted: "Deleted.",
            loadError: "Could not load services.",
            saveError: "Could not save.",
            deleteError: "Could not delete.",
            idRequired: "Service ID is required.",
            nameRequired: "Both EN and FR names are required.",
            durationInvalid: "Duration must be a positive number.",
            priceInvalid: "Price must be 0 or more.",
        },

    },

    fr: {
        nav: {
            home: "Accueil",
            about: "À propos",
            contact: "Contact",
            exitAdmin: "Quitter le mode admin",
            addEmployee: "Ajouter un employé",
            calendar: "Calendrier des rendez-vous",
            unavailable: "Jours indisponibles",
            services: "Services",
            adminMode: "Mode admin",
            appointBtn: "Prendre un rendez-vous",
        },

        errors: {
            adminOnly: "Admin seulement. Connectez-vous avec le compte admin.",
            permission: "Permissions insuffisantes (règles Firestore).",
        },

        auth: {
            // Header / links
            loginLink: "Connexion",
            profileLinkTitle: "Aller à votre profil",

            // Common fields
            name: { label: "Nom", placeholder: "Votre nom" },
            email: { label: "Courriel", placeholder: "Courriel" },
            password: { label: "Mot de passe", placeholder: "Mot de passe" },

            login: {
                title: "Connexion",
                button: "Connexion",
                forgot: "Mot de passe oublié ?",
                noAccount: "Vous n’avez pas de compte ?",
                registerLink: "Créer un compte",
            },

            oauth: {
                google: "Continuer avec Google",
                facebook: "Continuer avec Facebook",
            },

            errors: {
                accountExistsDifferentCredential: "Un compte existe déjà avec cet email via une autre méthode. Connectez-vous avec la méthode originale pour lier vos comptes.",
            },


            register: {
                title: "Créer un compte",
                button: "Créer un compte",
                confirmLabel: "Confirmer le mot de passe",
                confirmPlaceholder: "Confirmer le mot de passe",
                haveAccount: "Vous avez déjà un compte ?",
                goLogin: "Aller à la connexion",
            },

            profile: {
                title: "Mon profil",
                save: "Enregistrer",
                logout: "Déconnexion",
                msgNotLoggedIn: "Vous n’êtes pas connecté(e).",
                msgUpdated: "Profil mis à jour.",
                msgUpdateFail: "Impossible de mettre à jour le profil. Réessayez.",
                msgLogoutFail: "Échec de la déconnexion. Réessayez.",
            },

            errors: {
                userNotFound: "Aucun compte n’existe avec ce courriel. Veuillez vous inscrire.",
                invalidCredential: "Courriel ou mot de passe incorrect.",
                invalidEmail: "Veuillez entrer une adresse courriel valide.",
                missingPassword: "Veuillez entrer votre mot de passe.",
                tooManyRequests: "Trop de tentatives. Réessayez plus tard.",
                loginFailed: "Connexion échouée. Veuillez réessayer.",
                enterEmailFirst: "Entrez votre courriel d’abord, puis cliquez sur « Mot de passe oublié ? »",
                resetSent: "Courriel de réinitialisation envoyé. Vérifiez votre boîte de réception.",
                resetGeneric: "Si un compte existe pour ce courriel, vous recevrez un message de réinitialisation sous peu.",
                nameRequired: "Veuillez entrer votre nom.",
                passwordsNoMatch: "Les mots de passe ne correspondent pas.",
                registerFailed: "Inscription échouée. Veuillez réessayer.",

            },
        },

        // ✅ ONE source of truth for service names (use: t("services."+id))
        services: {
            haircut: "Coupe",
            kids: "Coupe enfant",
            beard: "Taille de barbe",
            hair_beard: "Coupe + barbe",
        },

        home: {
            hero: {
                pill: "Coupes fraîches • Dégradés nets • Taille de barbe",
                title: "Soyez stylé. Soyez confiant.",
                sub: "Réservez en quelques secondes — barbiers professionnels, salon propre, résultats impeccables.",
                book: "Prendre un rendez-vous",
                gallery: "Voir la galerie",
            },
            addons: {
                online: { title: "Réservation en ligne", desc: "Planification rapide + rappels." },
                snacks: { title: "Collations gratuites", desc: "Détendez-vous pendant l’attente." },
                products: { title: "Produits premium", desc: "Soins cheveux & barbe disponibles." },
            },
            services: {
                title: "Services",
                subtitle: "Choisissez votre service — on s’occupe du reste.",
                haircut: { title: "Coupe", desc: "Coupe nette, finition précise." },
                fade: { title: "Coupe + Barbe", desc: "Doublez votre style." },
                beard: { title: "Barbe", desc: "Taille + contours pour un look propre." },
                kids: { title: "Coupe enfant", desc: "Rapide, sympa et impeccable." },
            },
            vibe: {
                clean: { title: "Confortable et propre", desc: "Un espace moderne avec une belle ambiance." },
                detail: { title: "Souci du détail", desc: "Contours, dégradés et lignes impeccables." },
                precision: {
                    title: "Précision à chaque fois",
                    desc: "Une constance sur laquelle vous pouvez compter.",
                },
            },
            gallery: {
                title: "Galerie",
                subtitle: "Coupes récentes et ambiance du salon.",
                cta: "Réserver",
            },
        },

        appoint: {
            submit: "Prendre un rendez-vous",

            title: "Prendre un rendez-vous",
            subtitle: "Choisissez un service et une heure. Nous confirmerons votre rendez-vous.",

            serviceLabel: "Service",
            servicePlaceholder: "Choisir un service",

            dresserLabel: "Coiffeur",
            dresserHint: "\"N’importe lequel\" sélectionne tous les coiffeurs.",

            dateLabel: "Date",
            timeLabel: "Heure",
            timePlaceholder: "Choisir une heure",

            nameLabel: "Nom complet",
            namePlaceholder: "Votre nom",
            phoneLabel: "Téléphone (optionnel)",
            phonePlaceholder: "(450) 000-0000",
            emailLabel: "Courriel",
            emailPlaceholder: "vous@exemple.com",
            notesLabel: "Notes (optionnel)",
            notesPlaceholder: "Quelque chose à savoir?",

            confirmBtn: "Confirmer le rendez-vous",
            upcomingTitle: "Vos rendez-vous à venir",
            pastBtn: "Rendez-vous passés",
            pastTitle: "Rendez-vous passés",
            noUpcoming: "Aucun rendez-vous à venir.",
            noPast: "Aucun rendez-vous passé.",
            loginToManage: "Connectez-vous pour voir et annuler vos rendez-vous.",
            authLoggedInAs: "Connecté en tant que : {email}",
            authLoggedOut: "Connectez-vous pour voir et annuler vos rendez-vous.",
            loginRequiredTitle: "Connexion requise",
            loginRequiredMsg: "Veuillez vous connecter pour prendre un rendez-vous.",
            loginRequiredLogin: "Connexion",
            loginRequiredRegister: "Inscription",
            loginRequiredBack: "Retour à l’accueil",

            any: "N’importe lequel",
            noStylists: "Aucun coiffeur configuré. Ajoutez-les en mode Admin.",
            noStylistsTitle: "Aucune coiffeur disponible",

            selectServiceDays: "Sélectionnez un service pour voir les jours disponibles",
            pickDayTimes: "Choisissez un jour pour voir les heures.",
            dayBlocked: "Cette journée n’est pas disponible.",
            noTimes: "Aucune heure disponible pour ce jour.",
            times30: "Les heures sont affichées aux 30 minutes.",

            fillRequired: "Veuillez remplir tous les champs obligatoires.",
            invalidEmail: "Veuillez entrer une adresse courriel valide.",
            pickStylist: "Veuillez choisir un coiffeur (ou N’importe lequel).",
            noPreferredAtTime: "Aucun coiffeur choisi n’est disponible à cette heure.",
            overlap: "Cette heure chevauche un rendez-vous existant pour ce coiffeur.",
            saved: "Rendez-vous enregistré ! Nous vous contacterons pour confirmer.",

            hairdresserPrefix: "Coiffeur :",
            removeBtn: "Annuler le rendez-vous",

            hoursTitle: "Disponibilité",
            hoursClosed: "Fermé",
            hoursNotSet: "Horaire non défini",

            dayMon: "Lundi",
            dayTue: "Mardi",
            dayWed: "Mercredi",
            dayThu: "Jeudi",
            dayFri: "Vendredi",
            daySat: "Samedi",
            daySun: "Dimanche",

            cal: {
                client: "Client",
                service: "Service",
                barber: "Barbier",
                notes: "Notes",
                phone: "Téléphone",
                date: "Date",
                time: "Heure",

            },

            email: {
                thankYou: "Merci d’avoir choisi UBarbershop !",
                confirmed: "Votre rendez-vous chez UBarbershop est confirmé.",
                with: "avec",
                clientNotes: "Notes du client :",
                addToCalendar: "Ajouter au calendrier :",
                btnGoogle: "Google Agenda",
                btnOutlook: "Calendrier Outlook",
                btnIphone: "Calendrier iPhone",
                tip:
                    "Astuce : certaines applications de messagerie ajoutent automatiquement l’événement lorsqu’elles détectent une date et une heure.",
                cancelText: "Si vous devez annuler votre rendez-vous,",
                clickHere: "cliquez ici",
                reschedule:
                    "Si vous devez annuler ou modifier votre rendez-vous, veuillez contacter le salon directement.",
                thanks: "Merci,",
                phoneLabel: "Téléphone (optionnel)",
                shopPhoneLabel: "Téléphone",
                subject: "Rendez-vous confirmé — UBarbershop",
                preview: "Votre rendez-vous chez UBarbershop a été confirmé.",
                reminderTitle: "Rappel de rendez-vous",
                reminderIntro: "Vous avez un rendez-vous demain chez UBarbershop.",
                reminderSubject: "Rappel : votre rendez-vous demain",
                reminderPreview: "Vous avez un rendez-vous demain chez UBarbershop.",
                cancelledSubject: "Rendez-vous annulé — UBarbershop",
                cancelledTitle: "Rendez-vous annulé chez UBarbershop",
                cancelledClientIntro: "Votre rendez-vous a été annulé.",
                cancelledSalonIntro: "Votre rendez-vous a été annulé par le salon.",
                cancelledByClientLabel: "Annulé par le client",
                cancelledBySalonLabel: "Annulé par le salon",
                cancelledPreview: "Votre rendez-vous chez UBarbershop a été annulé.",
            },
        },

        footer: {
            categories: "Catégories",
            contact: "Contact",
            phone: "Téléphone",
            phoneLabel: "Téléphone :",
            newsletter: "Infolettre",
            follow: "Suivez-nous",
        },

        contact: {
            title: "Contactez-nous",
            helpTitle: "Nous sommes là pour vous aider",
            phoneLabel: "Téléphone :",
            addressLabel: "Adresse :",
            messageTitle: "Envoyez-nous un message",
            emailLabel: "Votre courriel",
            emailPlaceholder: "vous@exemple.com",
            messageLabel: "Votre message",
            messagePlaceholder: "Écrivez votre message ici...",
            submit: "Envoyer",
        },

        about: {
            title: "À propos de l’entreprise",
            subtitle: "Le premier projet entrepreneurial d’une jeune femme",
            p1:
                "UBarbershop a été créé comme le premier projet d’entreprise " +
                "d’une jeune femme animée par la passion, la détermination et l’envie " +
                "de bâtir quelque chose de significatif. L’ouverture de ce barbershop " +
                "représente une étape importante et le début d’une belle aventure " +
                "entrepreneuriale.",
            p2:
                "L’objectif de UBarbershop est d’offrir un espace accueillant et " +
                "professionnel où chaque client se sent en confiance, à l’aise et " +
                "respecté. Chaque détail — de l’ambiance aux services offerts — a " +
                "été soigneusement pensé afin d’assurer qualité et constance, " +
                "y compris les rafraîchissements gratuits offerts aux clients lors de leur visite.",
            p3:
                "Cette entreprise est bien plus qu’un simple barbershop; elle est le reflet " +
                "du travail acharné, de la persévérance et du courage nécessaire pour " +
                "transformer une vision en réalité. Elle démontre qu’avec de la " +
                "détermination et de l’ambition, un premier projet peut devenir quelque chose " +
                "de remarquable.",
            thanks: "Merci de soutenir une entreprise locale et de faire partie de cette aventure !",
        },

        admin: {
            title: "Admin – Employés",
            subtitle: "Ajoutez des coiffeurs et définissez leurs journées + heures de travail.",
            name: "Nom",
            namePlaceholder: "ex. Sofia",
            workSchedule: "Horaire de travail",
            addEmployee: "Ajouter un employé",
            currentEmployees: "Employés actuels",
            save: "Enregistrer",
            remove: "Supprimer",

            added: "Employé ajouté.",
            updated: "Employé mis à jour.",
            deleted: "Employé supprimé.",
            required: "Veuillez entrer un nom.",
            saved: "Enregistré.",

            edit: "Modifier",
            editTitle: "Modifier le/la coiffeur(euse)",
            cancel: "Annuler",
            saveChanges: "Enregistrer les modifications",
            off: "Fermé",
            none: "Aucun(e) coiffeur(euse) pour le moment.",
        },

        calendar: {
            pageTitle: "Admin – Rendez-vous",
            searchPlaceholder: "Rechercher nom / téléphone / service…",
            allHairdressers: "Tous les coiffeurs",
            clearAll: "Supprimer TOUS les rendez-vous enregistrés",
            removed: "Rendez-vous supprimé.",
            cleared: "Tous les rendez-vous ont été supprimés.",
            noAppointments: "Aucun rendez-vous",
            count: "{n} rendez-vous",
            noAppointmentsDay: "Aucun rendez-vous pour cette journée.",
            hairdresser: "Coiffeur :",
            fullName: "Nom complet", // ✅ added
            remove: "Annuler le rendez-vous",
            monthAriaPrev: "Mois précédent",
            monthAriaNext: "Mois suivant",
        },
        confirm: {
            deleteAppointment: "Êtes-vous sûr ?",
            confirmAction: "Oui, annuler le rendez-vous",
            keepAction: "Garder le rendez-vous",
            deleteEmployee: "Êtes-vous sûr de vouloir supprimer cet employé ?",
            deleteBlockedDay: "Supprimer cette journée bloquée ?",
            deleteService: "Supprimer ce service ?"
        },

        unavailable: {
            title: "Jours indisponibles",
            subtitle: "Bloquez des journées (vacances, fermeture, etc.). Les journées bloquées n’apparaîtront pas comme disponibles.",
            tip: "Astuce : choisissez la même date de début/fin pour bloquer une seule journée.",
            startDate: "Date de début",
            endDate: "Date de fin",
            employee: "Coiffeur",
            all: "Tous les coiffeurs (salon fermé)",
            allShort: "Tous",
            reason: "Raison (optionnel)",
            reasonPlaceholder: "Vacances / Fermé",
            add: "Ajouter",
            listTitle: "Journées bloquées à venir",
            none: "Aucune journée bloquée.",
            for: "Pour",
            remove: "Retirer",
            saved: "Enregistré.",
            savedRange: "{n} journée(s) enregistrée(s).",
            deleted: "Retiré.",
            loadError: "Impossible de charger les journées bloquées.",
            saveError: "Impossible d’enregistrer.",
            deleteError: "Impossible de retirer.",
            pickDate: "Veuillez choisir une date.",
            pickRange: "Veuillez choisir une date de début et une date de fin.",
            rangeInvalid: "La date de fin doit être égale ou après la date de début.",
            tooMany: "Veuillez choisir une plage plus courte (max {n} jours).",
            confirmRange: "Bloquer {n} journée(s) ?",
            preview: "Blocage de {n} journée(s) : {start} → {end}",
        },

        servicesAdmin: {
            title: "Services",
            subtitle: "Ajoutez, modifiez ou supprimez des services. Ces services apparaîtront sur la page de réservation.",
            id: "ID du service",
            idPlaceholder: "coupe",
            nameEn: "Nom (EN)",
            nameFr: "Nom (FR)",
            duration: "Durée (minutes)",
            price: "Prix ($)",
            order: "Ordre d’affichage",
            active: "Actif",
            add: "Enregistrer",
            clear: "Effacer",
            listTitle: "Services actuels",
            none: "Aucun service.",
            edit: "Modifier",
            delete: "Supprimer",
            activePill: "Actif",
            inactivePill: "Inactif",
            saved: "Enregistré.",
            deleted: "Supprimé.",
            loadError: "Impossible de charger les services.",
            saveError: "Impossible d’enregistrer.",
            deleteError: "Impossible de supprimer.",
            idRequired: "L’ID du service est requis.",
            nameRequired: "Les noms EN et FR sont requis.",
            durationInvalid: "La durée doit être un nombre positif.",
            priceInvalid: "Le prix doit être 0 ou plus.",
        },

    },
};

const LANG_KEY = "lang";
const DEFAULT_LANG = "fr";

/* ---------------------------
   Helpers
--------------------------- */
function getByPath(obj, path) {
    return path.split(".").reduce((acc, key) => (acc && acc[key] != null ? acc[key] : null), obj);
}

function interpolate(str, vars = {}) {
    let out = String(str);
    for (const [k, v] of Object.entries(vars)) {
        out = out.replaceAll(`{${k}}`, String(v));
    }
    return out;
}

function translate(lang, path, vars = {}) {
    const raw =
        getByPath(translations[lang], path) ??
        getByPath(translations[DEFAULT_LANG], path) ??
        null;

    if (raw == null) return path; // fallback to key if missing
    if (typeof raw !== "string") return path; // safety: prevent [object Object]
    return interpolate(raw, vars);
}

/* ---------------------------
   Global helper for other JS files
   window.t("calendar.count", {n: 3})
--------------------------- */
window.t = function t(path, vars = {}) {
    const lang = localStorage.getItem(LANG_KEY) || DEFAULT_LANG;
    return translate(lang, path, vars);
};

window.tLang = function tLang(lang, path, vars = {}) {
    const resolved = translations[lang] ? lang : DEFAULT_LANG;
    return translate(resolved, path, vars);
};

/* ---------------------------
   Apply language to DOM
--------------------------- */
function applyLanguage(lang) {
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;

    // text
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.dataset.i18n;
        const val = getByPath(translations[lang], key) ?? getByPath(translations[DEFAULT_LANG], key);
        if (typeof val === "string") el.textContent = val;
    });

    // placeholders
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        const key = el.dataset.i18nPlaceholder;
        const val = getByPath(translations[lang], key) ?? getByPath(translations[DEFAULT_LANG], key);
        if (typeof val === "string") el.setAttribute("placeholder", val);
    });

    // value
    document.querySelectorAll("[data-i18n-value]").forEach((el) => {
        const key = el.dataset.i18nValue;
        const val = getByPath(translations[lang], key) ?? getByPath(translations[DEFAULT_LANG], key);
        if (typeof val === "string") el.value = val;
    });

    // aria-label
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
        const key = el.dataset.i18nAria;
        const val = getByPath(translations[lang], key) ?? getByPath(translations[DEFAULT_LANG], key);
        if (typeof val === "string") el.setAttribute("aria-label", val);
    });

    // Tell other scripts (calendar / appointment) language changed
    window.dispatchEvent(new CustomEvent("lang:changed", { detail: { lang } }));
}

/* ---------------------------
   Public API
--------------------------- */
window.setLanguage = function setLanguage(lang) {
    if (!translations[lang]) lang = DEFAULT_LANG;
    applyLanguage(lang);
};

/* ---------------------------
   Init
--------------------------- */
document.addEventListener("DOMContentLoaded", () => {
    const savedLang = localStorage.getItem(LANG_KEY) || DEFAULT_LANG;
    window.setLanguage(savedLang);

    // Buttons: <button data-lang="en">EN</button> <button data-lang="fr">FR</button>
    document.querySelectorAll(".lang-switcher button[data-lang]").forEach((btn) => {
        btn.addEventListener("click", () => window.setLanguage(btn.dataset.lang));
    });
});
