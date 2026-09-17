import { createContext, useState, useEffect } from 'react';
import { createTheme } from '@mui/material/styles';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [currentTheme, setCurrentTheme] = useState(() => {
        // Load theme from local storage or default to light
        const storedTheme = sessionStorage.getItem('appTheme');
        return storedTheme || 'light';
    });

    useEffect(() => {
        sessionStorage.setItem('appTheme', currentTheme);
    }, [currentTheme]);

    const themeConfig = {
        light: createTheme({
            palette: {
                mode: 'light',
                primary: {
                    main: '#3f51b5',
                },
                secondary: {
                    main: '#f50057',
                },
                // Add other light theme customizations here
            },
        }),
        dark: createTheme({
            palette: {
                mode: 'dark',
                primary: {
                    main: '#90caf9',
                },
                secondary: {
                    main: '#f48fb1',
                },
                background: {
                    default: '#303030',
                    paper: '#424242',
                },
                // Add other dark theme customizations here
            },
        }),
        cosmos: createTheme({
            palette: {
                mode: 'light', // Or 'dark' depending on your cosmos theme
                primary: {
                    main: '#6a1b9a', // Example cosmos primary color
                },
                secondary: {
                    main: '#d81b60', // Example cosmos secondary color
                },
                background: {
                    default: '#e0f7fa', // Example cosmos background
                    paper: '#b2ebf2', // Example cosmos paper
                },
                text: {
                    primary: '#212121',
                    secondary: '#757575',
                },
                // Add your specific cosmos theme colors and typography
            },
            typography: {
                fontFamily: 'Roboto, sans-serif', // Example cosmos font
            },
            components: {
                // You can customize MUI components further for your cosmos theme
                MuiButton: {
                    styleOverrides: {
                        root: {
                            borderRadius: 20,
                        },
                    },
                },
            },
        }),
    };

    const theme = themeConfig[currentTheme];

    const changeTheme = (newTheme) => {
        setCurrentTheme(newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, currentTheme, changeTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};