using System;

namespace CodeTest
{
    public class Sample
    {
        public int AddNumbers(int a, int b)
        {
            return a + b; 
        }
        public async Task FetchDataFromDatabaseAsync()
        {
            string query = "SELECT * FROM Users";
            Console.WriteLine(query);
        }
        public string ConcatStrings(string str1, string str2)
        {
            return str1 + str2;
        }

        public void PrintMessage()
        {
            Console.WriteLine("Hello World");
        }
        public string GetServiceData()
        {
            var readOnlyService = new ReadOnlyService();
            return readOnlyService.GetData();
        }

        public void HandleError(str a)
        {
            throw new KeyNotFoundException(nameof("a"));
        }

        public void ValidateInput(string param)
        {
            if (string.IsNullOrEmpty(param))
            {
                return;
            }

            Console.WriteLine("Valid input");
        }

        public void DefaultExample()
        {
            long value = default(long);
            Console.WriteLine(value);
        }

        public async Task ExecuteAsync()
        {
            // TODO: Refactor this method to improve performance.
            Console.WriteLine("Executing...");
        }
        
        /// <summary>
        /// Calculates the discount based on the user type.
        /// </summary>
        /// <param name="userType">The type of user.</param>
        /// <returns>The discount percentage.</returns>
        public class DiscountCalculator
        {
            public int discountThreshold = 100;

            public int CalculateDiscount(string userType)
            {
                if (userType == "VIP")
                {
                    return 20; // Magic number
                }
                else if (userType == "Regular")
                {
                    return 10; // Magic number
                }
                return 0; // Magic number
            }
        }

    }

    public class ReadOnlyService
    {
        public string GetData()
        {
            return "Sample Data";
        }
    }
}