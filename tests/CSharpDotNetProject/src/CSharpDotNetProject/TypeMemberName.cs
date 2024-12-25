namespace CSharpDotNetProject;

public class TypeMemberName
{
    public const string NAME_CUSTOMER = "Foo";

    public DateTime Created { get; }
    public IDictionary<long, long> Mapping { get; }
    public double Price { get; }

    private readonly Product _product;
}

class Product
{
}